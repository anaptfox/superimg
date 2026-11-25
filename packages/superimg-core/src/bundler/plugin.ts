//! Server-side superimg bundler plugin (Node rolldown).
//! Resolves `superimg` / define / stdlib to real package dist (or monorepo src) paths.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSuperimgPlugin,
  STDLIB_NOOP_ID,
  type MediaAuthoringFacadeModules,
} from "./plugin.shared.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Well-known subpaths that don't match dist/<name>.js */
const STDLIB_SPECIAL: Record<string, string> = {
  code: "dist/code.js",
  cue: "dist/cue/index.js",
  text: "dist/text.js",
  svg: "dist/svg/index.js",
  viz: "dist/viz/index.js",
  tree: "dist/tree/index.js",
  "tree/lower": "dist/tree/lower.js",
  "tree/walk": "dist/tree/walk.js",
  arrange: "dist/arrange/index.js",
};

function firstExisting(candidates: string[]): string | null {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function findStdlibPkgRoot(): string {
  // Prefer package resolution — works when this plugin is inlined into
  // packages/superimg/dist/chunks/* (Electron wallpapers, CLI assembly) where
  // __dirname is no longer packages/superimg-core/dist.
  try {
    return dirname(require.resolve("@superimg/stdlib/package.json"));
  } catch {
    /* monorepo / source layouts below */
  }
  const candidates = [
    resolve(__dirname, "../node_modules/@superimg/stdlib"),
    resolve(__dirname, "../../node_modules/@superimg/stdlib"),
    resolve(__dirname, "../../superimg-stdlib"),
    // Bundled into packages/superimg/dist/chunks/node (ir-eval.js)
    resolve(__dirname, "../../../../superimg-stdlib"),
    resolve(__dirname, "../../../superimg-stdlib"),
    resolve(__dirname, "../../../node_modules/@superimg/stdlib"),
    // Walk from monorepo cwd
    resolve(process.cwd(), "packages/superimg-stdlib"),
    resolve(process.cwd(), "../packages/superimg-stdlib"),
    resolve(process.cwd(), "../../packages/superimg-stdlib"),
  ];
  for (const root of candidates) {
    if (existsSync(resolve(root, "dist/code.js"))) return root;
  }
  return candidates[0]!;
}

/**
 * Real module for bare `import … from "@foxworth/superimg"`.
 * Monorepo builds use `template-public`, whose value exports match the
 * `superimg` package root. Published installs resolve the package entry.
 */
export function resolveTemplateRuntimePath(): string {
  // Prefer the module beside this source/build so tests never race a parallel
  // package build that is replacing dist. Bundled consumers fall through to
  // package resolution and workspace build locations.
  const found = firstExisting([
    resolve(__dirname, "../template-public.js"),
    resolve(__dirname, "template-public.js"),
    resolve(__dirname, "../template-public.ts"),
    resolve(__dirname, "../../src/template-public.ts"),
    // When bundled into packages/superimg-cli/dist/plugin.js
    resolve(__dirname, "../../superimg-core/dist/template-public.js"),
    resolve(__dirname, "../superimg-core/dist/template-public.js"),
    // When inlined into packages/superimg/dist/chunks/* (Electron / server import)
    resolve(__dirname, "../../../../superimg-core/dist/template-public.js"),
    resolve(__dirname, "../../../superimg-core/dist/template-public.js"),
    // Walk monorepo from cwd
    resolve(process.cwd(), "packages/superimg-core/dist/template-public.js"),
    resolve(process.cwd(), "../packages/superimg-core/dist/template-public.js"),
    resolve(process.cwd(), "../../packages/superimg-core/dist/template-public.js"),
  ]);
  if (found) return found;
  // When this plugin is bundled into the published umbrella package, resolve
  // the package's own authoring entry. It contains the complete template
  // runtime while keeping private workspace packages out of the consumer.
  try {
    return require.resolve("@foxworth/superimg");
  } catch {
    /* source/workspace layouts below */
  }
  try {
    return require.resolve("@superimg/core/template-public");
  } catch {
    /* package is not installed in this layout */
  }
  throw new Error(
    "Cannot resolve template-public. Build @superimg/core (pnpm run build) first.",
  );
}

/** Real browser-safe authoring module for `@foxworth/superimg/interactive/define`. */
export function resolveInteractivePath(): string {
  try {
    return require.resolve("@superimg/interactive/define");
  } catch {
    /* monorepo/source layouts + host-linked superimg below */
  }
  // Host projects may link the superimg umbrella package; nested
  // @superimg/interactive is not always require-resolvable from their cwd
  // because package exports omit a CJS "default" condition.
  try {
    return require.resolve("@foxworth/superimg/interactive/define");
  } catch {
    /* continue */
  }
  const found = firstExisting([
    // Source-loaded compiler tests run from src/bundler, before private dist exists.
    resolve(__dirname, "../../../superimg-interactive/src/define.ts"),
    resolve(__dirname, "../../superimg-interactive/dist/define.js"),
    resolve(__dirname, "../../superimg-interactive/src/define.ts"),
    resolve(__dirname, "../node_modules/@superimg/interactive/dist/define.js"),
    resolve(__dirname, "../../node_modules/@superimg/interactive/dist/define.js"),
    // Bundled into packages/superimg/dist/chunks/node (CLI / host engines)
    resolve(__dirname, "../interactive/define.js"),
    resolve(__dirname, "../../interactive/define.js"),
    resolve(
      __dirname,
      "../../../node_modules/@superimg/interactive/dist/define.js",
    ),
    resolve(
      __dirname,
      "../../../../@superimg/interactive/dist/define.js",
    ),
    resolve(process.cwd(), "packages/superimg-interactive/dist/define.js"),
    resolve(process.cwd(), "packages/superimg-interactive/src/define.ts"),
  ]);
  if (found) return found;
  throw new Error(
    "Cannot resolve @foxworth/superimg/interactive/define. Build @superimg/interactive first.",
  );
}

/** Browser-safe interactive authoring for host facade re-exports. */
export function resolveInteractivePackagePath(): string {
  return resolveInteractivePath();
}

/**
 * Resolve any `@superimg/stdlib/<sub>` to a real dist file.
 * Compose/template-runtime depend on the full stdlib graph, so subpaths must
 * resolve to their concrete modules.
 */
export function resolveStdlibPath(sub: string, stdlibRoot: string): string | null {
  if (sub === "" || sub === ".") {
    return firstExisting([resolve(stdlibRoot, "dist/index.js")]);
  }
  const special = STDLIB_SPECIAL[sub];
  if (special) {
    const p = resolve(stdlibRoot, special);
    if (existsSync(p)) return p;
  }
  return firstExisting([
    resolve(stdlibRoot, `dist/${sub}.js`),
    resolve(stdlibRoot, `dist/${sub}/index.js`),
  ]);
}

const STDLIB_PKG_ROOT = findStdlibPkgRoot();

export interface CreateSuperimgPluginOptions {
  /** Host-defined bare specifiers mapped to absolute browser-safe module files. */
  readonly authoringFacades?: MediaAuthoringFacadeModules;
}

/** Real module for `@foxworth/superimg/film`. */
export function resolveFilmPath(): string | null {
  try {
    return require.resolve("@foxworth/superimg/film");
  } catch {
    /* monorepo/source layouts below */
  }
  const found = firstExisting([
    // Bundled into packages/superimg/dist/chunks/* (published package)
    resolve(__dirname, "../film.js"),
    resolve(__dirname, "../../film.js"),
    // Monorepo built umbrella or film package (from src/bundler, dist/, or dist/chunks/node/)
    resolve(__dirname, "../../superimg/dist/film.js"),
    resolve(__dirname, "../../../superimg/dist/film.js"),
    resolve(__dirname, "../../../../superimg/dist/film.js"),
    resolve(__dirname, "../../superimg-film/dist/index.js"),
    resolve(__dirname, "../../../superimg-film/dist/index.js"),
    resolve(__dirname, "../../../../superimg-film/dist/index.js"),
    resolve(__dirname, "../../../../superimg-film/src/index.ts"),
    resolve(__dirname, "../../../superimg-film/src/index.ts"),
    resolve(__dirname, "../../superimg-film/src/index.ts"),
    resolve(process.cwd(), "packages/superimg/dist/film.js"),
    resolve(process.cwd(), "packages/superimg-film/dist/index.js"),
    resolve(process.cwd(), "packages/superimg-film/src/index.ts"),
    resolve(process.cwd(), "../superimg/dist/film.js"),
    resolve(process.cwd(), "../superimg-film/dist/index.js"),
  ]);
  if (found) return found;
  try {
    return require.resolve("@superimg/film");
  } catch {
    return null;
  }
}

export function createSuperimgPlugin(options: CreateSuperimgPluginOptions = {}) {
  return buildSuperimgPlugin({
    resolveSuperimg: () => resolveTemplateRuntimePath(),
    resolveInteractive: () => resolveInteractivePath(),
    resolveFilm: () => resolveFilmPath(),
    resolveAuthoringFacade(source) {
      const target = options.authoringFacades?.[source];
      if (target === undefined) return null;
      if (!isAbsolute(target)) {
        throw new Error(
          `Authoring facade ${JSON.stringify(source)} must map to an absolute module path`,
        );
      }
      return target;
    },
    resolveStdlibSubpath(sub) {
      // A packed consumer owns the public package, not the monorepo's private
      // @superimg/stdlib topology. Prefer its explicit exported subpath.
      try {
        return require.resolve(`@foxworth/superimg/stdlib/${sub}`);
      } catch {
        return resolveStdlibPath(sub, STDLIB_PKG_ROOT) ?? STDLIB_NOOP_ID;
      }
    },
  });
}
