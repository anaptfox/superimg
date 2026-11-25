import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    document: "src/document.ts",
  },
  outDir: "dist",
});
