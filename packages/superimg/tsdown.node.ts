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
    "index.react-server": "src/index.react-server.ts",
    "index.server": "src/index.server.ts",
    ...stdlibEntries,
  },
  define: sharedDefine,
  deps: sharedDeps,
  outputOptions: {
    chunkFileNames: "chunks/node/[name].js",
  },
});
