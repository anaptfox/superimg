import { describe, expect, it } from "vitest";
import { normalizeEncodingQuality } from "./encoding-types.js";

describe("normalizeEncodingQuality", () => {
  it("normalizes valid preset, bitrate, and quantizer forms", () => {
    expect(normalizeEncodingQuality("high")).toBe("high");
    expect(normalizeEncodingQuality({ bitrate: 2_000_000, mode: "variable" })).toEqual({ bitrate: 2_000_000, mode: "variable" });
    expect(normalizeEncodingQuality({ quantizer: 22 })).toEqual({ quantizer: 22 });
  });

  it("rejects malformed untyped JSON quality values", () => {
    for (const value of ["cinema", null, {}, { bitrate: 100, quantizer: 22 }, { bitrate: 0 }, { bitrate: 100, mode: "fast" }, { quantizer: -1 }]) {
      expect(() => normalizeEncodingQuality(value as never)).toThrow();
    }
  });
});
