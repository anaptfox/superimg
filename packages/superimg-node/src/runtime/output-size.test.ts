import { describe, expect, it } from "vitest";
import { assertStillOutputSize } from "./adapter.js";

function pngWithIhdr(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[11] = 13;
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("still output size", () => {
  it("accepts a PNG whose IHDR matches the expected canvas", async () => {
    await expect(assertStillOutputSize(pngWithIhdr(1200, 630), "png", { width: 1200, height: 630 }))
      .resolves.toBeUndefined();
  });

  it("rejects a PNG whose IHDR disagrees with the expected canvas", async () => {
    await expect(assertStillOutputSize(pngWithIhdr(2400, 1260), "png", { width: 1200, height: 630 }))
      .rejects.toMatchObject({
        code: "OUTPUT_SIZE_MISMATCH",
        message: expect.stringContaining("2400×1260"),
      });
  });
});
