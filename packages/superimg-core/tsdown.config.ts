import { defineConfig } from "tsdown";

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
    errors: "src/errors/index.ts",
    "errors-node": "src/errors-node.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: ["rolldown", "@rolldown/browser"],
  },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
