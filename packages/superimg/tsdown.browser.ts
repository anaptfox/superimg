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
    "browser-export": "src/index.browser-export.ts",
    "browser-export.react-server": "src/index.browser-export.react-server.ts",
    "runtime.browser": "src/runtime.browser.ts",
    "bundler-browser": "src/bundler-browser.ts",
    "interactive/player": "src/index.interactive-player.ts",
    "react/interactive": "src/react/interactive.ts",
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
    // Lazy capability chunks re-import bindings from the entry; keep those
    // internal names readable instead of minified (`n`, `t`).
    minifyInternalExports: false,
  },
});
