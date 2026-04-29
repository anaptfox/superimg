import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The skill examples import from "superimg" but we don't want to depend on
      // the built dist for tests. Map to the source-level shared entrypoint, which
      // re-exports defineScene/defineConfig.
      superimg: fileURLToPath(new URL("./src/index.shared.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
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
