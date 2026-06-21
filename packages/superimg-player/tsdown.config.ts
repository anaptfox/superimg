import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  outDir: "dist",
  outExtensions: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js',
    dts: '.d.ts',
  }),
});
