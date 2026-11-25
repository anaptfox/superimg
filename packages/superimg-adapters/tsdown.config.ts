import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: [
    "src/index.ts",
    "src/poster.ts",
    "src/stage.ts",
    "src/vite.ts",
    "src/providers.ts",
    "src/media-project.ts",
  ],
  outDir: "dist",
  external: ["vite", "@superimg/types", "http"],
});
