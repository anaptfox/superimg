import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  resolve: {
    // Vitest's Workers pool otherwise falls back to the package's Node import
    // condition while transforming the test graph. Pin the assembled edge
    // binder so this gate exercises the same file a workerd consumer loads.
    alias: {
      "@foxworth/superimg/runtime/html": fileURLToPath(
        new URL("../superimg/dist/runtime/html.js", import.meta.url),
      ),
      "@foxworth/superimg/runtime": fileURLToPath(new URL("../superimg/dist/runtime.edge.js", import.meta.url)),
    },
    conditions: ["workerd", "worker", "import"],
  },
  test: {
    include: ["src/edge.test.ts"],
  },
});
