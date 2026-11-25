import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    vite: "src/vite.ts",
  },
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react-router",
    "@foxworth/superimg",
    "@foxworth/superimg/react/player",
    "vite",
    "@superimg/adapters",
    "@superimg/types",
  ],
});
