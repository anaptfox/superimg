import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    vite: "src/vite.ts",
  },
  outDir: "dist",
  external: ["astro", "vite", "@superimg/adapters", "@superimg/types", "@foxworth/superimg"],
});
