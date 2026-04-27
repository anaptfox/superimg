import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  splitting: false,
  bundle: true,
});
