import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["browser", "import"] },
  test: {
    include: ["src/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
      // Opt in for interactive failure replay; canvas and image snapshots are
      // valuable for export tests but make the trace artifacts larger.
      traceView: {
        enabled: process.env.SUPERIMG_TRACE_VIEW === "1",
        recordCanvas: true,
        inlineImages: true,
      },
    },
  },
});
