import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const superimgPkg = JSON.parse(
  readFileSync(resolve(__dirname, "../superimg/package.json"), "utf8"),
);
if (typeof superimgPkg.version !== "string" || !superimgPkg.version) {
  throw new Error(
    "tsdown.config.ts: could not read version from ../superimg/package.json",
  );
}

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts",
    server: "src/server.ts",
    container: "src/container/handler.ts",
    integration: "src/integration/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(superimgPkg.version),
  },
  deps: {
    alwaysBundle: [
      "@superimg/types",
      "@superimg/stdlib",
      /^@superimg\/core/,
      "@superimg/runtime",
      "@superimg/player",
      "@superimg/skill",
      "@superimg/playwright",
      "hono",
      "@hono/node-server",
      "zod",
      // @babel/code-frame is CJS; keeping it external causes dynamic-require failures
      // in the ESM bundle. Bundle it + its small CJS deps inline instead.
      "@babel/code-frame",
      "@babel/helper-validator-identifier",
      "js-tokens",
      "picocolors",
    ],
    neverBundle: [
      "zustand",
      "date-fns",
      "colord",
      "simplex-noise",
      "playwright",
      "playwright-core",
      "rolldown",
      "@rolldown/browser",
      "commander",
      "acorn",
      "ink",
      "react",
      "vite",
      "ws",
      "oxc-parser",
      /^@oxc-parser\//,
      // mediabunny + node-av have native bindings (@seydx/node-av-*) — can't bundle.
      // Container Dockerfile installs them explicitly; server.js consumers have them
      // in their own node_modules via @superimg/playwright transitive deps.
      "mediabunny",
      "@mediabunny/server",
      "node-av",
      /^@seydx\//,
      "sharp",
    ],
  },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  onSuccess: "cd dev-ui && vite build",
});
