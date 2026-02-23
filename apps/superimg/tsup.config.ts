import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "index.browser": "src/index.browser.ts",
    "index.server": "src/index.server.ts",
    "index.player": "src/index.player.ts",
    stdlib: "src/stdlib.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  // Bundle internal workspace packages, externalize npm deps
  noExternal: [
    "@superimg/types",
    "@superimg/stdlib",
    /^@superimg\/core/,
    "@superimg/runtime",
    "@superimg/playwright",
    "hono",
    "@hono/node-server",
    "zod",
  ],
  external: [
    "zustand",
    "date-fns",
    "colord",
    "simplex-noise",
    "playwright",
    "esbuild",
  ],
});
