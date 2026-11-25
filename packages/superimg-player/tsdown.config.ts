import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    dom: "src/index.dom.ts",
    program: "src/index.program.ts",
    inspection: "src/index.inspection.ts",
    "timeline-lanes": "src/timeline-lanes.ts",
  },
  outDir: "dist",
  outputOptions: { chunkFileNames: "chunks/[name].js" },
});
