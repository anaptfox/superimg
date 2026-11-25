import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    "theme/SuperImgPlayer/index": "src/theme/SuperImgPlayer/index.tsx",
    "theme/AnimatedFigure/index": "src/theme/AnimatedFigure/index.tsx",
  },
  outDir: "dist",
  // Do not deep-resolve peer .d.ts graphs (webpack / joi / docusaurus).
  dts: { resolve: false },
  deps: {
    neverBundle: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@docusaurus/BrowserOnly",
      "@foxworth/superimg",
      "@foxworth/superimg/react/player",
      "@superimg/adapters",
      "@superimg/types",
    ],
  },
});
