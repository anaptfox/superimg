import { defineConfig } from "tsdown";
import { coreNeverBundle } from "@superimg/build-config/bundle-deps";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  platform: "node",
  entry: {
    index: "src/index.ts",
    html: "src/html.ts",
    "bundler-browser": "src/bundler-browser.ts",
    bundler: "src/bundler.ts",
    "bundler-plugin": "src/bundler-plugin.ts",
    "template-runtime": "src/template-runtime.ts",
    engine: "src/engine.ts",
    "template-metadata": "src/template-metadata.ts",
    validation: "src/validation.ts",
    critique: "src/critique/motion-critique.ts",
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
