import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["node", "import"] },
  test: {
    environment: "node",
    include: ["src/node.test.ts"],
  },
});
