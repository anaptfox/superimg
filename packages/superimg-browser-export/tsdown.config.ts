import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: ["src/index.ts", "src/encoder.ts"],
  outDir: "dist",
});
