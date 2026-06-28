import { defineConfig } from "tsdown";
import { libraryDefaults, publishChecks } from "../build-policy/tsdown.base.ts";
import { sharedDefine, sharedDeps } from "./tsdown.shared.ts";

export default defineConfig({
  name: "browser",
  ...libraryDefaults,
  platform: "browser",
  shims: false,
  clean: false,
  entry: {
    "index.browser": "src/index.browser.ts",
    "bundler-browser": "src/bundler-browser.ts",
    player: "src/index.player.ts",
    "runtime-web": "src/index.runtime-web.ts",
    "react/index": "src/react/index.ts",
    "react/react-server": "src/react/react-server.ts",
    "react/player": "src/react/player.ts",
    "react/compile": "src/react/compile.ts",
  },
  define: sharedDefine,
  deps: sharedDeps,
  ...publishChecks,
});