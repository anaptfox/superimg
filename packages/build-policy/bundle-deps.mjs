/**
 * Shared tsdown bundle policy for SuperImg packages.
 */

/** Private workspace packages — always inline into published superimg. */
export const workspaceBundle = [
  "@superimg/cli",
  "@superimg/types",
  "@superimg/stdlib",
  /^@superimg\/core/,
  "@superimg/runtime",
  "@superimg/runtime-web",
  "@superimg/player",
  "@superimg/skill",
  "@superimg/playwright",
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
  ...nodeExternals,
  ...browserExternals,
  ...wasmExternals,
  // Stdlib peers that may remain external on browser/edge platform builds
  "path-data-parser",
  "source-map-js",
];

/** @superimg/core policy */
export const coreNeverBundle = ["rolldown", "@rolldown/browser", ...wasmExternals];

/** Profiles for check-externals.mjs */
export const profiles = {
  superimg: { alwaysBundle: superimgAlwaysBundle, neverBundle: superimgNeverBundle },
  cli: { alwaysBundle: cliAlwaysBundle, neverBundle: cliNeverBundle },
  core: { alwaysBundle: [], neverBundle: coreNeverBundle },
};