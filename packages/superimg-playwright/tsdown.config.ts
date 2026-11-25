import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    engine: "src/engine.ts",
    "sharp-still-encoder": "src/sharp-still-encoder.ts",
    "node-encoder": "src/node-encoder.ts",
    "ffmpeg-gif-encoder": "src/ffmpeg-gif-encoder.ts",
  },
  outputOptions: {
    chunkFileNames: "chunks/[name].js",
  },
  deps: {
    neverBundle: ["rolldown", "playwright", "playwright-core"],
  },
});
