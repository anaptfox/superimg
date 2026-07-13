import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";

const pathShim = fileURLToPath(new URL("./test-shims/node-path.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "node:path": pathShim,
      path: pathShim,
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
    },
    server: {
      deps: {
        inline: ["@superimg/core", "@superimg/types", "@zumer/snapdom", "mediabunny"],
      },
    },
  },
});