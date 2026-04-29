import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const superimgPkg = JSON.parse(
  readFileSync(resolve(__dirname, "../superimg/package.json"), "utf8"),
);
if (typeof superimgPkg.version !== "string" || !superimgPkg.version) {
  throw new Error(
    "tsup.config.ts: could not read version from ../superimg/package.json",
  );
}

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts",
    server: "src/server.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(superimgPkg.version),
  },
  noExternal: [
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
  ],
  external: [
    "zustand",
    "date-fns",
    "colord",
    "simplex-noise",
    "playwright",
    "playwright-core",
    "esbuild",
    "esbuild-wasm",
    "commander",
    "acorn",
    "ink",
    "react",
    "vite",
    "ws",
    "oxc-parser",
    /^@oxc-parser\//,
  ],
  onSuccess: "cd dev-ui && vite build",
});
