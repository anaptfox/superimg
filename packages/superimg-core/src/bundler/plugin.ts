//! Server-side superimg bundler plugin (Node rolldown).
//! Resolves `superimg` / define / stdlib to real package dist (or monorepo src) paths.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSuperimgPlugin,
  STDLIB_NOOP_ID,
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
};

function firstExisting(candidates: string[]): string | null {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function findStdlibPkgRoot(): string {
  const candidates = [
    resolve(__dirname, "../node_modules/@superimg/stdlib"),
    resolve(__dirname, "../../node_modules/@superimg/stdlib"),
    resolve(__dirname, "../../superimg-stdlib"),
  ];
  for (const root of candidates) {
    if (existsSync(resolve(root, "dist/code.js"))) return root;
  }
  return candidates[0]!;
}

/** Real module for bare `import … from "superimg"` (define + compose + scene). */
export function resolveTemplateRuntimePath(): string {
  // Prefer package export — works when this plugin is bundled into CLI dist
  // (where __dirname is no longer packages/superimg-core/dist).
  try {
    return require.resolve("@superimg/core/template-runtime");
  } catch {
    /* monorepo / source layouts below */
  }
  const found = firstExisting([
    resolve(__dirname, "../template-runtime.js"),
    resolve(__dirname, "template-runtime.js"),
    resolve(__dirname, "../template-runtime.ts"),
    resolve(__dirname, "../../src/template-runtime.ts"),
    // When bundled into packages/superimg-cli/dist/plugin.js
    resolve(__dirname, "../../superimg-core/dist/template-runtime.js"),
    resolve(__dirname, "../superimg-core/dist/template-runtime.js"),
  ]);
  if (found) return found;
  throw new Error(
    "Cannot resolve template-runtime. Build @superimg/core (pnpm run build) first.",
  );
}

/** Real module for `superimg/define` — always the typed define helpers. */
export function resolveDefinePath(): string {
  const found = firstExisting([
    resolve(__dirname, "../../superimg/dist/define.js"),
    resolve(__dirname, "../node_modules/superimg/dist/define.js"),
    resolve(__dirname, "../../node_modules/superimg/dist/define.js"),
    resolve(__dirname, "../../superimg-types/dist/index.js"),
    resolve(__dirname, "../node_modules/@superimg/types/dist/index.js"),
  ]);
  if (found) return found;
  try {
    return require.resolve("superimg/define");
  } catch {
    try {
      return require.resolve("@superimg/types");
    } catch {
      throw new Error(
        "Cannot resolve superimg/define. Build packages/superimg or @superimg/types first.",
      );
    }
  }
}

/**
 * Resolve any `@superimg/stdlib/<sub>` to a real dist file.
 * Unlike the old string-runtime approach, compose/template-runtime depend on
 * the full stdlib graph — we must not strip subpaths to empty modules.
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

export function createSuperimgPlugin() {
  return buildSuperimgPlugin({
    resolveSuperimg: () => resolveTemplateRuntimePath(),
    resolveDefine: () => resolveDefinePath(),
    resolveStdlibSubpath(sub) {
      const abs = resolveStdlibPath(sub, STDLIB_PKG_ROOT);
      if (!abs) return STDLIB_NOOP_ID;
      return abs;
    },
  });
}
