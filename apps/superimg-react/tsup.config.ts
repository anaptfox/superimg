import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    player: "src/player.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "superimg", "superimg/player", "superimg/browser", "superimg/stdlib"],
});
