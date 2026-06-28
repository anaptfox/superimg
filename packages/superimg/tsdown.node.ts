import { defineConfig } from "tsdown";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";
import { sharedDefine, sharedDeps, stdlibEntries } from "./tsdown.shared.ts";

export default defineConfig({
  name: "node",
  ...libraryDefaults,
  platform: "node",
  clean: true,
  entry: {
    index: "src/index.shared.ts",
    "index.react-server": "src/index.react-server.ts",
    "index.server": "src/index.server.ts",
    cli: "src/cli.ts",
    ...stdlibEntries,
  },
  define: sharedDefine,
  deps: sharedDeps,
  onSuccess: "rm -rf dist/dev-ui && cp -R ../superimg-cli/dist/dev-ui dist/dev-ui",
});