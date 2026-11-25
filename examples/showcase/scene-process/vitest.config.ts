import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const source = (path: string) => fileURLToPath(new URL(`../../../packages/${path}`, import.meta.url));

export default defineConfig({
  resolve: { alias: {
    "@foxworth/superimg/interactive/define": source("superimg-interactive/src/define.ts"),
    "@foxworth/superimg/interactive/player": source("superimg-interactive/src/player.ts"),
    "@foxworth/superimg/player/program": source("superimg-player/src/program.ts"),
    "@foxworth/superimg/player": source("superimg-player/src/index.ts"),
    "@superimg/core/composition": source("superimg-core/src/composition.ts"),
    "@superimg/core/ir": source("superimg-core/src/ir/index.ts"),
    "@superimg/core/player-core": source("superimg-core/src/player-core.ts"),
    "@superimg/core/player-composition": source("superimg-core/src/player-composition.ts"),
    "@superimg/core": source("superimg-core/src/index.ts"),
    "@superimg/media": source("superimg-media/src/index.ts"),
    "@superimg/player": source("superimg-player/src/index.ts"),
  } },
  test: {
    include: ["examples/showcase/scene-process/*.test.ts"],
    setupFiles: [source("superimg-media/vitest.setup.ts")],
    environment: "node",
  },
});
