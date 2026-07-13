import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformAlias, platformDeps, sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "edge",
  ...libraryDefaults,
  outDir: ".build/edge",
  platform: "neutral",
  clean: true,
  entry: {
    "index.edge": "src/index.edge.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  alias: platformAlias,
  // Namespace shared chunks so this secondary build can't overwrite node entries.
  outputOptions: {
    chunkFileNames: "chunks/edge/[name].js",
  },
});
