import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@superimg/core/html", replacement: resolve(__dirname, "../superimg-core/src/html/html.ts") },
      { find: "@superimg/core", replacement: resolve(__dirname, "../superimg-core/src/index.ts") },
      { find: "@superimg/stdlib/svg", replacement: resolve(__dirname, "../superimg-stdlib/src/svg/index.ts") },
      { find: "@superimg/stdlib/viz", replacement: resolve(__dirname, "../superimg-stdlib/src/viz/index.ts") },
      { find: /^@superimg\/stdlib\/(.+)$/, replacement: resolve(__dirname, "../superimg-stdlib/src/$1.ts") },
      { find: "@superimg/stdlib", replacement: resolve(__dirname, "../superimg-stdlib/src/index.ts") },
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
