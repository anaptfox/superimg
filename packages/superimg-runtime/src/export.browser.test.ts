import { describe, expect, it } from "vitest";
import { exportToVideo } from "./export.js";
import { get2DContext } from "./utils.js";

describe("exportToVideo", () => {
  it("encodes a short clip from canvas frames", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = get2DContext(canvas);

    const blob = await exportToVideo(
      canvas,
      { fps: 10, width: 160, height: 90, duration: 0.3 },
      async (frame) => {
        ctx.fillStyle = frame % 2 === 0 ? "#2244aa" : "#aa4422";
        ctx.fillRect(0, 0, 160, 90);
      }
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/video\//);
  }, 30_000);
});