import { describe, it, expect } from "vitest";
import {
  debandRaw,
  interleavedGradientNoise,
  whiteNoise01,
} from "./still-deband.js";

describe("still-deband", () => {
  it("IGN is deterministic and varies spatially", () => {
    expect(interleavedGradientNoise(0, 0)).toBe(interleavedGradientNoise(0, 0));
    expect(interleavedGradientNoise(10, 20)).not.toBe(
      interleavedGradientNoise(11, 20),
    );
  });

  it("whiteNoise01 is deterministic", () => {
    expect(whiteNoise01(1, 2, 0)).toBe(whiteNoise01(1, 2, 0));
  });

  it("none mode returns identical buffer", () => {
    const raw = Buffer.alloc(4 * 4 * 4, 40);
    const out = debandRaw(raw, 4, 4, 4, { mode: "none" });
    expect(out.equals(raw)).toBe(true);
  });

  it("blue-noise breaks a stepped ramp into non-uniform neighbors", () => {
    const w = 64;
    const h = 8;
    const ch = 4;
    const raw = Buffer.alloc(w * h * ch);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const band = Math.floor(x / 8) * 8;
        const i = (y * w + x) * ch;
        raw[i] = band;
        raw[i + 1] = band;
        raw[i + 2] = band;
        raw[i + 3] = 255;
      }
    }
    const out = debandRaw(raw, w, h, 4, {
      mode: "blue-noise",
      strength: 0.5,
    });
    expect(out.equals(raw)).toBe(false);
    const col = 12;
    const vals = new Set<number>();
    for (let y = 0; y < h; y++) {
      vals.add(out[(y * w + col) * ch]!);
    }
    expect(vals.size).toBeGreaterThan(1);
  });
});
