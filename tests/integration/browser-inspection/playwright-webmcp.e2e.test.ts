import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { startFixture } from "./support/fixture-server.js";

// Qualify Playwright's native WebMCP transport against a real installed Boundary
// binding. Host admission and registration withdrawal still govern every call.
describe("Playwright native WebMCP", () => {
  it("discovers, invokes, denies and withdraws a mounted preview tool", async () => {
    const fixture = await startFixture("native-binding-app.ts");
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true, args: ["--enable-features=WebMCP"] });
      const page = await browser.newPage();
      await page.goto(fixture.origin);
      await page.waitForFunction(() => document.body.dataset.ready !== undefined);
      const ready = await page.evaluate(() => ({
        ready: document.body.dataset.ready, error: document.body.dataset.error,
      }));
      expect(ready, ready.error).toMatchObject({ ready: "success" });

      const toolName = "fixture.preview.inspect";
      expect(await page.webmcp.tools()).toEqual([
        expect.objectContaining({
          name: toolName,
          inputSchema: expect.objectContaining({ required: ["surfaceId"] }),
        }),
      ]);
      const invoke = async () => {
        const result = await page.webmcp.callTool(toolName, { surfaceId: "primary" });
        // Chromium may serialize the checked outcome at the native API seam.
        return typeof result === "string" ? JSON.parse(result) : result;
      };
      expect(await invoke()).toMatchObject({
        certainty: "completed",
        result: { kind: "returned", value: { surfaceId: "primary", frame: 0, frameCount: 7, fps: 25 } },
      });

      await page.evaluate("window.__inspectionFixture.deny()");
      expect(await invoke()).toMatchObject({
        certainty: "not-started", result: { kind: "denied" },
      });
      await page.evaluate("window.__inspectionFixture.withdraw()");
      await expect.poll(() => page.webmcp.tools()).toEqual([]);
      await expect(invoke()).rejects.toThrow(/does not register any WebMCP tools|No WebMCP tool/);
      await page.evaluate("window.__inspectionFixture.dispose()");
    } finally {
      await browser?.close();
      await fixture.close();
    }
  });
});
