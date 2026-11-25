import { defineConfig } from "tsdown";
import { cliAlwaysBundle, cliNeverBundle } from "../../tooling/build-config/bundle-deps.ts";
export default defineConfig({
  platform: "node", format: ["esm"], dts: { resolve: true }, hash: false,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  entry: {
    "index": "src/index.ts"
  },
  plugins: [{
    name: "superimg-shared-runtime-kernel",
    resolveId: {
      order: "pre",
      handler(source) {
        if (source === "@superimg/core/runtime") return { id: "@foxworth/superimg/internal/runtime-kernel", external: true };
      },
    },
  }],
  deps: { alwaysBundle: cliAlwaysBundle, neverBundle: [...cliNeverBundle, /^@foxworth\/superimg(?:\/|$)/] },
  outputOptions: { chunkFileNames: "chunks/[name].js" },
});
