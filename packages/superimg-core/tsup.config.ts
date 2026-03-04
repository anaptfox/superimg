import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    html: "src/html.ts",
    "bundler-browser": "src/bundler-browser.ts",
    bundler: "src/bundler.ts",
    engine: "src/engine.ts",
    "template-metadata": "src/template-metadata.ts",
    "bundler-plugin": "src/bundler-plugin.ts",
    validation: "src/validation.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  splitting: false,
  external: ["esbuild", "esbuild-wasm"],
});
