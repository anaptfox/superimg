import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    encoder: "src/encoder.ts",
    runtime: "src/runtime/index.ts",
  },
  outputOptions: {
    chunkFileNames: "chunks/[name].js",
  },
  outDir: "dist",
});
