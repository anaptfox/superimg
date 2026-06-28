import { defineConfig } from "tsdown";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";

export default defineConfig({
  ...libraryDefaults,
  entry: ["src/index.ts", "src/encoder.ts"],
  outDir: "dist",
});