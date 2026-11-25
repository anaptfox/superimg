import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8"),
);
if (typeof cliPkg.version !== "string" || !cliPkg.version) {
  throw new Error(
    "vitest.config.ts: could not read version from package.json",
  );
}

export default defineConfig({
  resolve: {
    alias: { "@superimg/core/runtime": "@foxworth/superimg/internal/runtime-kernel" },
  },
  define: {
    __SUPERIMG_VERSION__: JSON.stringify(cliPkg.version),
  },
  test: {
    server: { deps: { inline: ["@superimg/node", "@superimg/interactions"] } },
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "forks",
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/**/index.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        // No package-wide gate. New check/preflight files stay at 90% statements.
        "src/cli/utils/tree-check.ts": { statements: 90 },
        "src/cli/utils/chromium-preflight.ts": { statements: 90 },
      },
    },
  },
});
