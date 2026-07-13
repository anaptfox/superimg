/**
 * Shared tsdown bundle policy for SuperImg packages.
 */

/** Private workspace packages — always inline into published superimg. */
export const workspaceBundle = [
  "@superimg/cli",
  "@superimg/types",
  "@superimg/stdlib",
  /^@superimg\/core/,
  "@superimg/media",
  "@superimg/node",
  /^@superimg\/node\//,
  "@superimg/player",
  "@superimg/playwright",
  "@superimg/skill",
  "zod",
];

/** CLI-only inline deps (CJS shims, error formatting). */
export const cliInlineBundle = [
  "@babel/code-frame",
  "@babel/helper-validator-identifier",
  "js-tokens",
  "picocolors",
];

/** Node/server externals — resolved from node_modules at runtime. */
export const nodeExternals = [
  "@clack/prompts",
  "commander",
  "ink",
  "execa",
  "chokidar",
  "hono",
  "@hono/node-server",
  "ws",
  "rolldown",
  "oxc-parser",
  /^@oxc-parser\//,
  "playwright",
  "mediabunny",
  "@mediabunny/server",
  "sharp",
  "vite",
  "acorn",
];

/** Browser/client externals. */
export const browserExternals = [
  "@rolldown/browser",
  "react",
  "react-dom",
  "date-fns",
  "colord",
  "simplex-noise",
  "morphdom",
  "zustand",
  "mediabunny",
];

/** WASM binaries — never inline. */
export const wasmExternals = ["@resvg/resvg-wasm"];

/** @superimg/cli policy */
export const cliAlwaysBundle = [...workspaceBundle.filter((e) => e !== "@superimg/cli"), ...cliInlineBundle];
export const cliNeverBundle = [
  "@clack/prompts",
  "chokidar",
  "commander",
  "execa",
  "hono",
  "@hono/node-server",
  "ink",
  "react",
  "react/jsx-runtime",
  "ws",
  "rolldown",
  "oxc-parser",
  /^@oxc-parser\//,
  "playwright",
  "mediabunny",
  "@mediabunny/server",
  "sharp",
];

/** Published superimg policy */
export const superimgAlwaysBundle = workspaceBundle;
export const superimgNeverBundle = [
  "react",
  "react-dom",
  /^react\//,
  /^react-dom\//,
  "@rolldown/browser",
  "acorn",
  "date-fns",
  "colord",
  "simplex-noise",
  "morphdom",
  "zustand",
  "rolldown",
  "oxc-parser",
  /^@oxc-parser\//,
  ...wasmExternals,
  // Stdlib peers that may remain external on browser/edge platform builds
  "path-data-parser",
  "source-map-js",
];

/** @superimg/core policy */
export const coreNeverBundle = ["rolldown", "@rolldown/browser", ...wasmExternals];

/**
 * Platform builds (edge/browser/player/react-compile) must be dependency-self-contained
 * so a downstream consumer can copy the dist files verbatim. The runtime closure may
 * reference only the host-provided externals below; everything else is inlined.
 *
 * Reduced neverBundle (just the allowed externals) paired with an expanded alwaysBundle.
 * tsdown's alwaysBundle re-applies the global `external` via this.resolve, so a package
 * must be ABSENT from neverBundle AND PRESENT in alwaysBundle to inline. String patterns
 * are exact (picomatch) — use regex for any package with subpath imports.
 */
export const platformNeverBundle = [
  "react",
  "react-dom",
  /^react\//,
  /^react-dom\//,
  "@rolldown/browser",
  ...wasmExternals,
];

export const platformAlwaysBundle = [
  ...workspaceBundle,
  "@superimg/browser-export",
  /^@zumer\/snapdom($|\/)/,
  /^colord($|\/)/,
  /^date-fns($|\/)/,
  "simplex-noise",
  "morphdom",
  /^zustand($|\/)/,
  "mediabunny",
  /^path-data-parser($|\/)/,
  /^source-map-js($|\/)/,
];

/** Profiles for check-externals.mjs */
export const profiles = {
  superimg: { alwaysBundle: superimgAlwaysBundle, neverBundle: superimgNeverBundle },
  cli: { alwaysBundle: cliAlwaysBundle, neverBundle: cliNeverBundle },
  core: { alwaysBundle: [], neverBundle: coreNeverBundle },
  platform: { alwaysBundle: platformAlwaysBundle, neverBundle: platformNeverBundle },
};
