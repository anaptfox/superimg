import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["examples/marketing/superimg-launch/test/*.test.ts"],
    environment: "node",
  },
});
