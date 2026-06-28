import { defineConfig } from "tsdown";
import { coreNeverBundle } from "../build-policy/bundle-deps.mjs";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";

export default defineConfig({
  ...libraryDefaults,
  platform: "node",
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
    testing: "src/testing/index.ts",
  },
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: coreNeverBundle,
  },
});