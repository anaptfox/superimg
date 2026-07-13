import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.node.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.node.test.ts", "src/**/*.d.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 0,
        branches: 0,
      },
    },
  },
});
