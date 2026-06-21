import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/encoder.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
