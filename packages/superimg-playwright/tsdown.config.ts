import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
  ],
  format: ["esm"],
  dts: true,
  deps: {
    neverBundle: ["rolldown", "playwright", "playwright-core"],
  },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
