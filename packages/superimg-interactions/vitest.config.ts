import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspacePackages = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: [
      { find: "@superimg/core/bundler", replacement: `${workspacePackages}superimg-core/src/bundler.ts` },
      { find: "@superimg/core/destinations", replacement: `${workspacePackages}superimg-core/src/destinations/index.ts` },
      { find: "@superimg/core/runtime", replacement: `${workspacePackages}superimg-core/src/runtime/index.ts` },
      { find: "@superimg/core/source-analysis", replacement: `${workspacePackages}superimg-core/src/source-analysis/index.ts` },
      { find: "@superimg/core/export", replacement: `${workspacePackages}superimg-core/src/export/index.ts` },
      { find: "@superimg/core/engine", replacement: `${workspacePackages}superimg-core/src/engine.ts` },
      { find: "@superimg/core/errors", replacement: `${workspacePackages}superimg-core/src/errors/index.ts` },
      { find: "@superimg/core/html", replacement: `${workspacePackages}superimg-core/src/html.ts` },
      { find: /^@superimg\/core$/, replacement: `${workspacePackages}superimg-core/src/index.ts` },
      { find: /^@superimg\/node$/, replacement: `${workspacePackages}superimg-node/src/index.ts` },
      { find: /^@superimg\/types$/, replacement: `${workspacePackages}superimg-types/src/index.ts` },
      { find: "oxc-parser", replacement: require.resolve("oxc-parser") },
    ],
  },
  test: {
    environment: "node",
    // Native compilation tests already run alongside other packages in Turbo.
    maxWorkers: 1,
    include: ["src/**/*.test.ts"],
  },
});
