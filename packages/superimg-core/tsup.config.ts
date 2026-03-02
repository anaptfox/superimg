import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    // Browser-safe (environment-agnostic)
    index: "src/index.ts",
    "bundler-browser": "src/bundler-browser.ts",
    // Server-only (Node.js — esbuild, fs, etc.)
    bundler: "src/bundler.ts",
    engine: "src/engine.ts",
    "template-metadata": "src/template-metadata.ts",
    "bundler-plugin": "src/bundler-plugin.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  splitting: false,
  external: ["esbuild", "esbuild-wasm"],
});
