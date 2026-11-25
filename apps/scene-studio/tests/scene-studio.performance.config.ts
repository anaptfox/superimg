import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/scene-studio.performance*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
