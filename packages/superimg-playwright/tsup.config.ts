import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
  ],
  format: ["esm"],
  dts: true,
  external: ["esbuild", "playwright", "playwright-core", "@sparticuz/chromium"],
});
