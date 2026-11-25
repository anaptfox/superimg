import { defineConfig } from "tsdown";
import { cliAlwaysBundle, cliNeverBundle } from "../../tooling/build-config/bundle-deps.ts";
export default defineConfig({
  platform: "node", format: ["esm"], dts: { resolve: true }, hash: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  entry: {
    "index": "src/index.ts",
    "source/advanced": "src/source-advanced.ts",
    "review/advanced": "src/review-advanced.ts",

    "arrangement": "src/arrangement.ts",
    "edit": "src/edit.ts",
    "baseline": "src/baseline.ts",

    "project": "src/project.ts",
    "project-tools": "src/project-tools.ts",
    "source": "src/source.ts",
    "review": "src/review.ts",
    "plate": "src/plate.ts",
    "cortex": "src/cortex.ts",
    "thumbnail": "src/thumbnail.ts",
    "narration": "src/narration.ts",
    "transcription": "src/transcription.ts",
    "media-preparation": "src/media-preparation.ts"
  },
  plugins: [{
    name: "superimg-shared-runtime-kernel",
    resolveId: {
      order: "pre",
      handler(source) {
        if (source === "@superimg/core/runtime") return { id: "@foxworth/superimg/internal/runtime-kernel", external: true };
      },
    },
  }],
  deps: { alwaysBundle: cliAlwaysBundle, neverBundle: [...cliNeverBundle, "node-av", /^@foxworth\/superimg(?:\/|$)/] },
  outputOptions: { chunkFileNames: "chunks/[name].js" },
});
