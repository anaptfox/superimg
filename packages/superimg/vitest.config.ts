import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@foxworth\/superimg\/react\/interactive$/,
        replacement: fileURLToPath(new URL("../superimg-interactive/src/InteractivePlayer.tsx", import.meta.url)),
      },
      {
        find: /^@foxworth\/superimg\/charts$/,
        replacement: fileURLToPath(new URL("../superimg-stdlib/src/charts/index.ts", import.meta.url)),
      },
      // Skill examples import from "@foxworth/superimg". Map to the authoring entry
      // (define helpers + layout tree), not the browser-shared graph.
      {
        find: "@foxworth/superimg",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
      // Exact so `@superimg/browser-export/runtime` resolves through package
      // exports. A string alias is a prefix and becomes `index.ts/runtime`.
      {
        find: /^@superimg\/browser-export$/,
        replacement: fileURLToPath(
          new URL("../superimg-browser-export/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    // Heavy dist import smokes need headroom under concurrent monorepo `turbo test`.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Avoid shared-worker contention when many packages import large dist graphs at once.
    pool: "forks",
    fileParallelism: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 0,
        branches: 0,
      },
    },
  },
});
