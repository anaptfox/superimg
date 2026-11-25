import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  dts: { resolve: true },
  hash: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  platform: "node",
  entry: ["src/index.ts"],
  outDir: "dist",
  deps: {
    neverBundle: [/^@foxworth\/boundary(?:\/|$)/],
  },
});
