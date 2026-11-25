import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformDeps, sharedDefine } from "./tsdown.shared.ts";

/** Isolated build owner for the framework-neutral browser Player contract. */
export default defineConfig({
  name: "player",
  ...libraryDefaults,
  outDir: ".build/player",
  platform: "browser",
  shims: false,
  clean: true,
  entry: {
    player: "src/index.player.ts",
    "player/dom": "src/index.player-dom.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  outputOptions: {
    chunkFileNames: "chunks/player/[name].js",
  },
});
