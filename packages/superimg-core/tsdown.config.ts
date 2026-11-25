import { defineConfig } from "tsdown";
import { coreNeverBundle } from "@superimg/build-config/bundle-deps";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  platform: "node",
  entry: {
    index: "src/index.ts",
    "index.edge": "src/index.edge.ts",
    html: "src/html.ts",
    "bundler-browser": "src/bundler-browser.ts",
    bundler: "src/bundler.ts",
    "bundler-plugin": "src/bundler-plugin.ts",
    "template-runtime": "src/template-runtime.ts",
    "template-public": "src/template-public.ts",
    engine: "src/engine.ts",
    "template-metadata": "src/template-metadata.ts",
    destinations: "src/destinations/index.ts",
    export: "src/export/index.ts",
    "source-analysis": "src/source-analysis/index.ts",
    validation: "src/validation.ts",
    critique: "src/critique/motion-critique.ts",
    errors: "src/errors/index.ts",
    "errors-node": "src/errors-node.ts",
    testing: "src/testing/index.ts",
    runtime: "src/runtime/index.ts",
    review: "src/review.ts",
    "takes/index": "src/takes/index.ts",
    arrange: "src/arrange/index.ts",
    cortex: "src/cortex/index.ts",
    ir: "src/ir/index.ts",
    edit: "src/edit.ts",
    "ir-node": "src/ir-node.ts",
    "rendering/resvg-rasterizer.edge": "src/rendering/resvg-rasterizer.edge.ts",
    "rendering/resvg-rasterizer.node": "src/rendering/resvg-rasterizer.node.ts",
  },
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: coreNeverBundle,
  },
  // Shared chunks must not take a public entry name such as template-runtime.
  outputOptions: { chunkFileNames: "chunks/node/[name].js" },
});
