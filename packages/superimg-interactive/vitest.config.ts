import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@superimg/core/ir": resolve(__dirname, "../superimg-core/src/ir/index.ts"),
      "@superimg/core/player-core": resolve(__dirname, "../superimg-core/src/player-core.ts"),
      "@superimg/core/player-composition": resolve(__dirname, "../superimg-core/src/player-composition.ts"),
      "@superimg/core": resolve(__dirname, "../superimg-core/src/index.ts"),
      "@superimg/media": resolve(__dirname, "../superimg-media/src/index.ts"),
      "@superimg/player": resolve(__dirname, "../superimg-player/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    environmentOptions: { happyDOM: { settings: { enableIframePageLoading: true } } },
    setupFiles: [resolve(__dirname, "../superimg-media/vitest.setup.ts")],
    include: ["src/**/*.test.ts"],
  },
});
