/**
 * Shared tsdown bundle policy for SuperImg packages.
 */

/** Workspace packages inlined into published bundles. The public facade does not inline the CLI or interactions host. */
export const workspaceBundle = [
  "@superimg/types",
  "@foxworth/superimg-script",
  "@superimg/stdlib",
  /^@superimg\/core/,
  "@superimg/media",
  "@superimg/node",
  /^@superimg\/node\//,
  /^@superimg\/edge-runtime(?:\/.*)?$/,
  "@superimg/player",
  "@superimg/playwright",
  "@superimg/skill",
  "ajv",
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
  /^@foxworth\/boundary(?:\/|$)/,
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
  "@mediabunny/dts",
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
  "mediabunny",
];

/** WASM binaries — never inline. */
export const wasmExternals = ["@resvg/resvg-wasm"];

/** @foxworth/superimg-cli policy */
export const cliAlwaysBundle = [
  ...workspaceBundle.filter((e) => e !== "@foxworth/superimg-cli"),
  "@superimg/interactions",
  "@superimg/adapters",
  /^@superimg\/adapters(?:\/.*)?$/,
  "@superimg/interactive",
  /^@superimg\/interactive(?:\/.*)?$/,
  ...cliInlineBundle,
];
export const cliNeverBundle = [
  // The compatibility entry must share the independent interaction module.
  /^@foxworth\/superimg-interactions(?:\/|$)/,
  /^@foxworth\/superimg-node(?:\/|$)/,
  /^@foxworth\/boundary(?:\/|$)/,
  "@modelcontextprotocol/client",
  /^@modelcontextprotocol\/client\//,
  "@modelcontextprotocol/server",
  /^@modelcontextprotocol\/server\//,
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
  "@mediabunny/dts",
  "sharp",
  ...wasmExternals,
  // Wasm bindgen glue + .wasm sit in packages/superimg-blitz/pkg — never inline.
  "@superimg/blitz",
];

/** Published superimg policy */
export const superimgAlwaysBundle = [
  ...workspaceBundle,
  // The public facade reaches D3 through stdlib viz. Inline the complete family
  // so the assembled package never exposes undeclared transitive dependencies.
  /^d3-[^/]+(?:\/.*)?$/,
];
export const superimgNeverBundle = [
  "mediabunny",
  "@mediabunny/server",
  "@mediabunny/dts",
  /^@foxworth\/boundary(?:\/|$)/,
  "react",
  "react-dom",
  /^react\//,
  /^react-dom\//,
  "@rolldown/browser",
  "date-fns",
  "colord",
  "simplex-noise",
  "playwright",
  "@superimg/blitz",
  "node-av",
  "roughjs",
  "saxes",
  "sharp",
  ...wasmExternals,
  // Stdlib peers that may remain external on browser/edge platform builds
  "path-data-parser",
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
  "@zumer/snapdom-pdf",
  /^@zumer\/snapdom-plugins($|\/)/,
  "@zumer/snapdom-vector",
  /^colord($|\/)/,
  /^date-fns($|\/)/,
  "simplex-noise",
  "morphdom",
  "mediabunny",
  "@mediabunny/dts",
  // Platform closures use D3 through stdlib viz and must carry its transitive modules.
  /^d3-[^/]+(?:\/.*)?$/,
  /^roughjs($|\/)/,
  /^path-data-parser($|\/)/,
  /^source-map-js($|\/)/,
  /^saxes($|\/)/,
  /^xmlchars($|\/)/,
];

/** Profiles for check-externals.mjs */
export const profiles = {
  superimg: { alwaysBundle: superimgAlwaysBundle, neverBundle: superimgNeverBundle },
  // The CLI shares one external Boundary SDK instance with its host.
  cli: {
    alwaysBundle: cliAlwaysBundle,
    neverBundle: cliNeverBundle,
    facadeExternals: ["@foxworth/boundary"],
  },
  core: { alwaysBundle: [], neverBundle: coreNeverBundle },
  platform: { alwaysBundle: platformAlwaysBundle, neverBundle: platformNeverBundle },
};
