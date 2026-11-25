import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    "source-analysis": "src/library/source-analysis.ts",
    "edit-errors": "src/library/edit-errors.ts",
    "source-inspect": "src/library/source-inspect.ts",
    "review/advanced": "src/library/review-advanced-entry.ts",

    "source-evaluate": "src/library/source-evaluate.ts",
    "source-check": "src/library/source-check.ts",

    arrangement: "src/library/arrangement-entry.ts",
    edit: "src/library/edit-entry.ts",
    baseline: "src/library/baseline.ts",

    internal: "src/internal.ts",
    runtime: "src/runtime/index.ts",
    project: "src/library/project.ts",
    "project-tools": "src/library/project-entry.ts",
    source: "src/library/source-entry.ts",
    review: "src/library/review.ts",
    "review-clock": "src/library/review-clock.ts",
    plate: "src/library/plate.ts",
    thumbnail: "src/library/thumbnail.ts",
    narration: "src/library/narration-entry.ts",
    transcription: "src/library/transcription.ts",
    "media-preparation": "src/media-preparation.ts",
  },
  outputOptions: {
    chunkFileNames: "chunks/[name].js",
  },
  deps: {
    neverBundle: ["playwright", "playwright-core"],
  },
});
