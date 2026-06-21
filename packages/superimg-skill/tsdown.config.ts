import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
