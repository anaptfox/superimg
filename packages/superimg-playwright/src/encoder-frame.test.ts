import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeEncoderFrame } from "./encoder-frame.js";

describe("encoder capture dimensions", () => {
  it("downsamples the complete device-scale screenshot instead of truncating its stride", async () => {
    const pixels = Buffer.alloc(4 * 4 * 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        pixels.set([x * 70, y * 70, 120, 255], (y * 4 + x) * 4);
      }
    }
    const screenshot = await sharp(pixels, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
    const result = await decodeEncoderFrame(screenshot, 2, 2);
    expect(result).toHaveLength(16);
    // Both horizontal and vertical information from the far edges must survive.
    expect(result[4]).toBeGreaterThan(result[0]! + 80);
    expect(result[9]).toBeGreaterThan(result[1]! + 80);
    expect(result.equals(pixels.subarray(0, 16))).toBe(false);
  });

  it("honors explicitly padded RGBA rows", async () => {
    const data = Uint8Array.from([10, 20, 30, 40, 99, 99, 99, 99, 50, 60, 70, 80, 99, 99, 99, 99]);
    expect(await decodeEncoderFrame({ kind: "rgba", data, width: 1, height: 2, stride: 8 }, 1, 2))
      .toEqual(Buffer.from([10, 20, 30, 40, 50, 60, 70, 80]));
  });

  it("does not guess raw input from an encoded buffer's length", async () => {
    const screenshot = await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } })
      .png().toBuffer();
    // Trailing bytes are legal for PNG. Make its byte length equal a coded RGBA buffer.
    const collision = Buffer.concat([screenshot, Buffer.alloc(1024 - screenshot.length)]);
    const decoded = await decodeEncoderFrame(collision, 16, 16);
    expect(decoded.subarray(0, 4)).toEqual(Buffer.from([255, 0, 0, 255]));
  });

  it("accepts encoded byte arrays from native SVG rasterizers", async () => {
    const screenshot = await sharp({ create: { width: 1, height: 1, channels: 4, background: "red" } }).png().toBuffer();
    expect(await decodeEncoderFrame(new Uint8Array(screenshot), 1, 1)).toEqual(Buffer.from([255, 0, 0, 255]));
  });

  it("rejects raw bytes without a descriptor and inconsistent raw layouts", async () => {
    await expect(decodeEncoderFrame(Buffer.alloc(16), 2, 2)).rejects.toThrow();
    await expect(decodeEncoderFrame({ kind: "rgba", data: new Uint8Array(12), width: 2, height: 2 }, 2, 2))
      .rejects.toThrow(/length and stride/);
    await expect(decodeEncoderFrame({ kind: "rgba", data: new Uint8Array(16), width: 2, height: 2, stride: 4 }, 2, 2))
      .rejects.toThrow(/length and stride/);
    await expect(decodeEncoderFrame({ kind: "rgba", data: new Uint8Array(0), width: 0, height: 2 }, 2, 2))
      .rejects.toThrow(/dimensions/);
  });
});
