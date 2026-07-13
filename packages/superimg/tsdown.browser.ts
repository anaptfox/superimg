import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";
import { platformDeps, sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "browser",
  ...libraryDefaults,
  outDir: ".build/browser",
  platform: "browser",
  shims: false,
  clean: true,
  entry: {
    "index.browser": "src/index.browser.ts",
    "bundler-browser": "src/bundler-browser.ts",
    player: "src/index.player.ts",
    media: "src/index.media.ts",
    "react/index": "src/react/index.ts",
    "react/react-server": "src/react/react-server.ts",
    "react/player": "src/react/player.ts",
    "react/compile": "src/react/compile.ts",
    "react/session": "src/react/session.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  // Secondary builds share dist/ with the node build (which owns root filenames).
  // Namespace shared chunks under dist/chunks/ so they never collide with — and
  // overwrite — the node build's package entry (e.g. dist/index.d.ts).
  outputOptions: {
    chunkFileNames: "chunks/browser/[name].js",
  },
});
