//! Full Vite integration for SuperImg client apps.
//! @experimental Draft — plugin + config substrate for Vite / TanStack Start / React Router.
//!
//! Features:
//! - Dependency graph: pre-bundle client SuperImg entries; keep server engines out of client
//! - Base-path aware asset helper (import.meta.env.BASE_URL)
//! - Strict transform guard against @foxworth/superimg-cli (and friends) in browser code
//! - HMR: .media.ts / .media.js changes force full reload of dependent modules

import type { Plugin, ResolvedConfig } from "vite";

export interface SuperimgViteOptions {
  /**
   * Public base path for assets (e.g. `/docs/` or CDN prefix).
   * Applied via Vite `base` when `applyBase` is true (default).
   */
  base?: string;
  /** When true (default), set Vite `base` from options.base. */
  applyBase?: boolean;
  /**
   * Ensure browser-safe SuperImg entrypoints are pre-bundled and server entries
   * are not optimized into the client graph.
   */
  optimizeDeps?: boolean;
  /**
   * Fail the transform when client modules import server-only packages.
   * @default true
   */
  strictServerImports?: boolean;
}

/**
 * Workspace adapter packages — always load from linked dist (do not prebundle).
 * Prebundling freezes exports in node_modules/.vite and breaks when we add APIs
 * (e.g. renderSkeletonStage) until the cache is manually wiped.
 */
export const SUPERIMG_WORKSPACE_NO_PREBUNDLE = [
  "@superimg/adapters",
  "@superimg/adapters/poster",
  "@superimg/adapters/stage",
  "@superimg/adapters/vite",
  "@superimg/adapters/providers",
] as const;

/** Client import map for documentation / fixture assertions. */
export const SUPERIMG_CLIENT_IMPORTS = [
  "@foxworth/superimg",
  "@foxworth/superimg/runtime",
  "@foxworth/superimg/player",
  "@foxworth/superimg/ir",
  "@foxworth/superimg/react/player",
  "@foxworth/superimg/interactive/define",
  "@foxworth/superimg/interactive/player",
  "@foxworth/superimg/react/interactive",
  "@foxworth/superimg/player/dom",
  // adapters are listed for fixtures/docs but must not be force-prebundled
  ...SUPERIMG_WORKSPACE_NO_PREBUNDLE,
] as const;

/** Packages that must stay out of the browser optimize/SSR client graph. */
export const SUPERIMG_SERVER_ONLY_IMPORTS = [
  "@foxworth/superimg-cli",
  "@superimg/playwright",
  "playwright",
  "playwright-core",
  "sharp",
  "@mediabunny/server",
  "ffmpeg",
] as const;

/**
 * Imports forbidden in *application* client source (app/src), not in dependency graphs.
 * Intentionally excludes `node:*` — those appear inside published package internals
 * that Vite may still touch during graph walk; app authors should not import them.
 */
export const SUPERIMG_APP_FORBIDDEN_IMPORTS = [
  "@foxworth/superimg-cli",
  "@superimg/playwright",
  "playwright",
  "playwright-core",
  "sharp",
  "@mediabunny/server",
] as const;

const VIRTUAL_ID = "virtual:@foxworth/superimg/env";
const RESOLVED_VIRTUAL = "\0" + VIRTUAL_ID;

function forbiddenSpecifierPattern(specifier: string): string {
  const escaped = escapeRegExp(specifier);
  // @foxworth/superimg-cli/dev-server and every other subpath are the same host surface.
  return specifier === "@foxworth/superimg-cli" ? `${escaped}(?:/[^"']*)?` : escaped;
}

const APP_FORBIDDEN_IMPORT_RE = new RegExp(
  `from\\s+["'](${SUPERIMG_APP_FORBIDDEN_IMPORTS.map(forbiddenSpecifierPattern).join("|")})["']` +
    `|import\\s*\\(\\s*["'](${SUPERIMG_APP_FORBIDDEN_IMPORTS.map(forbiddenSpecifierPattern).join("|")})["']`,
);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns a partial Vite config object (mergeable). Prefer {@link superimg} plugin
 * for full support; this helper remains for lightweight merges.
 */
export function superimgViteConfig(
  options: SuperimgViteOptions = {},
): Record<string, unknown> {
  const applyBase = options.applyBase !== false;
  const optimize = options.optimizeDeps !== false;

  const config: Record<string, unknown> = {};
  if (applyBase && options.base !== undefined) {
    config.base = options.base;
  }
  if (optimize) {
    // Prebundle stable published-style deps; never freeze workspace adapters.
    const prebundle = SUPERIMG_CLIENT_IMPORTS.filter(
      (id) =>
        !(SUPERIMG_WORKSPACE_NO_PREBUNDLE as readonly string[]).includes(id),
    );
    config.optimizeDeps = {
      include: [...prebundle],
      exclude: [
        ...SUPERIMG_SERVER_ONLY_IMPORTS,
        ...SUPERIMG_WORKSPACE_NO_PREBUNDLE,
      ],
    };
    config.ssr = {
      external: [...SUPERIMG_SERVER_ONLY_IMPORTS],
      noExternal: [
        "@foxworth/superimg",
        "@foxworth/superimg/runtime",
        "@foxworth/superimg/player",
        "@foxworth/superimg/ir",
        "@foxworth/superimg/react/player",
        ...SUPERIMG_WORKSPACE_NO_PREBUNDLE,
      ],
    };
  }
  return config;
}

/**
 * Full SuperImg Vite plugin.
 *
 * ```ts
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import { superimg } from "@superimg/adapters/vite";
 *
 * export default defineConfig({
 *   plugins: [react(), superimg({ base: "/" })],
 * });
 * ```
 */
export function superimg(options: SuperimgViteOptions = {}): Plugin {
  const strict = options.strictServerImports !== false;
  let resolved: ResolvedConfig | undefined;

  return {
    name: "superimg",
    enforce: "pre",

    config() {
      return superimgViteConfig(options) as import("vite").UserConfig;
    },

    configResolved(config) {
      resolved = config;
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL;
      return null;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL) {
        const base = resolved?.base ?? options.base ?? "/";
        return [
          `export const SUPERIMG_BASE = ${JSON.stringify(base)};`,
          `export const SUPERIMG_DEV = import.meta.env.DEV;`,
          `export function superimgAssetUrl(path) {`,
          `  const p = String(path || "").replace(/^\\//, "");`,
          `  const b = SUPERIMG_BASE.endsWith("/") ? SUPERIMG_BASE : SUPERIMG_BASE + "/";`,
          `  return b + p;`,
          `}`,
        ].join("\n");
      }
      return null;
    },

    transform(code, id) {
      if (!strict) return null;
      if (id.includes("node_modules") || id.includes("\0")) return null;
      if (id.includes("?ssr") || id.includes("&ssr")) return null;
      if (!/\.(m?[jt]sx?|vue)($|\?)/.test(id)) return null;

      // Only lint application sources under the Vite project root — never monorepo packages.
      const root = resolved?.root;
      if (root) {
        const normalized = id.split("?")[0]!.replace(/\\/g, "/");
        const rootNorm = root.replace(/\\/g, "/");
        if (!normalized.startsWith(rootNorm + "/") && normalized !== rootNorm) {
          return null;
        }
        // Skip anything that looks like a workspace package path outside app src
        if (normalized.includes("/packages/superimg")) return null;
      }

      if (APP_FORBIDDEN_IMPORT_RE.test(code)) {
        const match = code.match(APP_FORBIDDEN_IMPORT_RE);
        const pkg = match?.[1] ?? match?.[2] ?? "server-only package";
        this.error(
          `[superimg] Client module imports server-only package "${pkg}":\n  ${id}\n` +
            `Use @foxworth/superimg/runtime, @foxworth/superimg/player, or @foxworth/superimg/ir instead of @foxworth/superimg-cli.`,
        );
      }
      return null;
    },

    handleHotUpdate(ctx) {
      const isMedia = ctx.file.endsWith(".media.ts") || ctx.file.endsWith(".media.js");
      if (!isMedia) return;
      // Media templates affect IR + player; force dependents to re-evaluate.
      ctx.server.ws.send({
        type: "custom",
        event: "superimg:media-update",
        data: { file: ctx.file },
      });
      return ctx.modules;
    },

  };
}

/** Join a site base path with a relative asset path (browser-safe). */
export function joinBasePath(base: string, assetPath: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  const p = assetPath.replace(/^\//, "");
  return `${b}${p}`;
}
