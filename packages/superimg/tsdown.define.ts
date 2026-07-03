import { defineConfig } from "tsdown";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";
import { sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "define",
  ...libraryDefaults,
  platform: "neutral",
  clean: false,
  entry: {
    define: "src/index.define.ts",
  },
  define: sharedDefine,
  deps: {
    alwaysBundle: ["@superimg/types"],
    neverBundle: [],
  },
  // Namespace shared chunks so this secondary build can't overwrite node entries.
  outputOptions: {
    chunkFileNames: "chunks/[name].js",
  },
});