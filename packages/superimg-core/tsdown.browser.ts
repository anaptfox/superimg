import { defineConfig } from "tsdown";
import { coreNeverBundle } from "@superimg/build-config/bundle-deps";
import { libraryDefaults } from "@superimg/build-config/tsdown";

// Browser-facing entries have their own output tree. A second tsdown run must
// never overwrite Node entry declarations or rename their shared chunks.
export default defineConfig({
  ...libraryDefaults,
  platform: "browser",
  entry: {
    composition: "src/composition.ts",
    source: "src/source.ts",
    "player-composition": "src/player-composition.ts",
    "player-core": "src/player-core.ts",
  },
  clean: true,
  outDir: "dist/browser",
  deps: { neverBundle: coreNeverBundle },
  outputOptions: { chunkFileNames: "chunks/[name].js" },
});
