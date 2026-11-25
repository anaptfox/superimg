import { defineConfig } from "tsdown";
import { libraryDefaults } from "@superimg/build-config/tsdown";

export default defineConfig({
  ...libraryDefaults,
  entry: {
    index: "src/index.ts",
    player: "src/player.ts",
    react: "src/react.ts",
    define: "src/define.ts",
  },
  outDir: "dist",
  // Keep shared declaration chunks from overwriting the public define entry.
  outputOptions: { chunkFileNames: "chunks/[name].js" },
});
