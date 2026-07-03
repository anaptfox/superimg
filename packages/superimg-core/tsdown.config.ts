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
    "rendering/resvg-rasterizer.edge": "src/rendering/resvg-rasterizer.edge.ts",
    "rendering/resvg-rasterizer.node": "src/rendering/resvg-rasterizer.node.ts",
  },
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: coreNeverBundle,
  },
});