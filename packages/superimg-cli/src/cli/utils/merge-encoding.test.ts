import { describe, it, expect } from "vitest";
import { mergeEncoding } from "./merge-encoding.js";

describe("mergeEncoding", () => {
  it("preserves gif options from base when override has format only", () => {
    const merged = mergeEncoding(
      { gif: { maxColors: 128, dither: "floyd_steinberg", loop: 1 } },
      { format: "gif" },
    );
    expect(merged?.format).toBe("gif");
    expect(merged?.gif).toEqual({
      maxColors: 128,
      dither: "floyd_steinberg",
      loop: 1,
    });
  });

  it("deep-merges capture and still (override wins per field)", () => {
    const merged = mergeEncoding(
      {
        capture: { dpr: 1, intermediate: "jpeg", jpegQuality: 90 },
        still: { quality: 80, lossless: false },
      },
      {
        capture: { dpr: 2 },
        still: { lossless: true },
      },
    );
    expect(merged?.capture).toEqual({
      dpr: 2,
      intermediate: "jpeg",
      jpegQuality: 90,
    });
    expect(merged?.still).toEqual({
      quality: 80,
      lossless: true,
    });
  });

  it("merges gif override onto base", () => {
    const merged = mergeEncoding(
      { gif: { maxColors: 256, dither: "sierra2_4a" } },
      { gif: { maxColors: 64 } },
    );
    expect(merged?.gif).toEqual({ maxColors: 64, dither: "sierra2_4a" });
  });
});
