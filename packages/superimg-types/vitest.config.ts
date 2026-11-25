import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Runtime unit tests only — *.test-types.ts are compile-time type checks, not vitest.
    include: ["src/**/*.test.ts"],
  },
});
