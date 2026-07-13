import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "define",
  ...libraryDefaults,
  outDir: ".build/define",
  platform: "neutral",
  clean: true,
  entry: {
    index: "src/index.shared.ts",
    define: "src/index.define.ts",
  },
  define: sharedDefine,
  deps: {
    alwaysBundle: ["@superimg/types"],
    neverBundle: [],
  },
  // Namespace shared chunks so this secondary build can't overwrite node entries.
  outputOptions: {
    chunkFileNames: "chunks/define/[name].js",
  },
});
