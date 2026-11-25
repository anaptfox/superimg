import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { sharedDefine, platformAlias } from "./tsdown.shared.ts";

export default defineConfig({
  name: "define",
  ...libraryDefaults,
  outDir: ".build/define",
  platform: "neutral",
  clean: true,
  entry: {
    index: "src/index.ts",
    "interactive/define": "src/index.interactive-define.ts",
    runtime: "src/runtime.ts",
    "runtime/describe": "src/runtime.describe.ts",
    "composition/prepare": "src/index.composition-prepare.ts",
    destinations: "src/index.destinations.ts",
    ir: "src/index.ir.ts",
    transcript: "src/transcript.ts",
    charts: "src/index.charts.ts",
    film: "src/index.film.ts",
    script: "src/index.script.ts",
    takes: "src/index.takes.ts",
    review: "src/index.review.ts",
  },
  define: sharedDefine,
  alias: { "path-data-parser": platformAlias["path-data-parser"] },
  deps: {
    // Bundle pure IR + types so @foxworth/superimg/ir stays browser-safe without Node.
    alwaysBundle: [
      "@superimg/types",
      "@superimg/film",
      "@foxworth/superimg-script",
      /^@superimg\/interactive(?:\/.*)?$/,
      "@superimg/core",
      /^@superimg\/core\//,
      "@superimg/stdlib",
      /^@superimg\/stdlib\//,
      /^@tanstack\/charts(?:\/.*)?$/,
      "path-data-parser",
      // Stdlib viz is part of the root authoring facade. Keep the complete D3
      // family inside the package rather than leaking transitive bare imports.
      /^d3-[^/]+(?:\/.*)?$/,
    ],
    neverBundle: [],
  },
  // Namespace shared chunks so this secondary build can't overwrite node entries.
  outputOptions: {
    chunkFileNames: "chunks/define/[name].js",
  },
});
