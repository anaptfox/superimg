import { defineConfig } from "tsup";

const browserOnly = !!process.env.SUPERIMG_BROWSER_ONLY;

export default defineConfig({
  entry: {
    "index.browser": "src/index.browser.ts",
    "index.player": "src/index.player.ts",
    "index.bundler": "src/index.bundler.ts",
    stdlib: "src/stdlib.ts",
    ...(browserOnly
      ? {}
      : {
          "index.server": "src/index.server.ts",
          cli: "src/cli/index.ts",
        }),
  },
  format: ["esm"],
  dts: true,
  clean: true,
  noExternal: [
    "@superimg/types",
    "@superimg/stdlib",
    /^@superimg\/core/,
    "@superimg/runtime",
    "@superimg/player",
    ...(browserOnly ? [] : ["@superimg/playwright"]),
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
    "playwright-core",
    "@sparticuz/chromium",
    "esbuild",
    "esbuild-wasm",
    "commander",
    "acorn",
    "ink",
    "react",
    "vite",
    "ws",
  ],
  ...(browserOnly
    ? {
        onSuccess: "cp dist/index.browser.js dist/index.server.js && cp dist/index.browser.d.ts dist/index.server.d.ts",
      }
    : { onSuccess: "cd dev-ui && vite build" }),
});
