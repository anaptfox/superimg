import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.node.test.ts"],
    environment: "node",
  },
});
