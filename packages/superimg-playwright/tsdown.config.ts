import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: ["src/index.ts"],
  deps: {
    neverBundle: ["rolldown", "playwright", "playwright-core"],
  },
});
