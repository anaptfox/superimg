import { defineConfig } from "tsdown";
import { libraryDefaults } from "../build-policy/tsdown.base.ts";
import { sharedDefine, sharedDeps } from "./tsdown.shared.ts";

export default defineConfig({
  name: "edge",
  ...libraryDefaults,
  platform: "neutral",
  clean: false,
  entry: {
    "index.edge": "src/index.edge.ts",
  },
  define: sharedDefine,
  deps: sharedDeps,
});