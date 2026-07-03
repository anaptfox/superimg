import { defineConfig } from "tsdown";
import { libraryDefaults, publishChecks } from "../build-policy/tsdown.base.ts";
import { platformDeps, sharedDefine } from "./tsdown.shared.ts";

export default defineConfig({
  name: "browser",
  ...libraryDefaults,
  platform: "browser",
  shims: false,
  clean: false,
  entry: {
    "index.browser": "src/index.browser.ts",
    "index.export": "src/index.export.ts",
    "bundler-browser": "src/bundler-browser.ts",
    player: "src/index.player.ts",
    "runtime-web": "src/index.runtime-web.ts",
    "react/index": "src/react/index.ts",
    "react/react-server": "src/react/react-server.ts",
    "react/player": "src/react/player.ts",
    "react/compile": "src/react/compile.ts",
    "react/export": "src/react/export.ts",
  },
  define: sharedDefine,
  deps: platformDeps,
  // Secondary builds share dist/ with the node build (which owns root filenames).
  // Namespace shared chunks under dist/chunks/ so they never collide with — and
  // overwrite — the node build's package entry (e.g. dist/index.d.ts).
  outputOptions: {
    chunkFileNames: "chunks/[name].js",
  },
  ...publishChecks,
});