import { defineConfig } from "vitest/config";

export default defineConfig({
  // Native Node cannot link resvg's raw WASM package asset because its `wbg`
  // imports are supplied by the Workers-aware bundler. This bounded gate
  // checks conditional resolution and the assembled graph without executing
  // the edge binder; `vitest.workerd.config.ts` is authoritative execution.
  test: {
    environment: "node",
    include: ["src/edge-resolution.test.ts"],
  },
});
