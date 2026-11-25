import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { sharedDefine, sharedDeps, stdlibEntries } from "./tsdown.shared.ts";

export default defineConfig({
  name: "node",
  ...libraryDefaults,
  outDir: ".build/node",
  platform: "node",
  clean: true,
  entry: {
    "runtime.node": "src/runtime.node.ts",
    "internal/runtime-kernel": "src/internal/runtime-kernel.ts",
    "vite": "src/vite.ts",
    ...stdlibEntries,
  },
  define: sharedDefine,
  deps: sharedDeps,
  outputOptions: {
    chunkFileNames: "chunks/node/[name].js",
    // Lazy chunks re-import bindings from entries; keep those names readable.
    minifyInternalExports: false,
  },
});
