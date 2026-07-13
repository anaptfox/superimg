import { describe, expect, it } from "vitest";
import { BrowserRenderer } from "./renderer.js";

describe("BrowserRenderer", () => {
  it("captures a single HTML frame", async () => {
    const renderer = new BrowserRenderer();
    await renderer.init({ width: 320, height: 180 });
    try {
      const imageData = await renderer.captureFrame(
        `<div style="width:320px;height:180px;background:#336699;color:#fff;display:flex;align-items:center;justify-content:center;font:24px system-ui">Hi</div>`
      );
      expect(imageData.width).toBe(320);
      expect(imageData.height).toBe(180);
      expect(imageData.data.length).toBe(320 * 180 * 4);
    } finally {
      await renderer.dispose();
    }
  });
});