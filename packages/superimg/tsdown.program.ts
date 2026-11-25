import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformDeps, sharedDefine } from "./tsdown.shared.ts";

/** Optional retained Program presentation, built after the lean Player entry. */
export default defineConfig({
  name: "program",
  ...libraryDefaults,
  outDir: ".build/player",
  platform: "browser",
  shims: false,
  clean: false,
  entry: {
    "player/program": "src/index.program.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  outputOptions: {
    chunkFileNames: "chunks/player/program/[name].js",
  },
});
