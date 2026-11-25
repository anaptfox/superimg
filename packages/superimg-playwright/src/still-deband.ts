//! Quantization deband for still encodes — breaks 8-bit gradient banding.
//! Blue-noise mode uses Interleaved Gradient Noise (Jimenez / COD-style IGN).

import type { StillDebandMode } from "@superimg/types";

function fract(x: number): number {
  return x - Math.floor(x);
}

/** Interleaved gradient noise in [0, 1). Spatially blue-ish, deterministic. */
export function interleavedGradientNoise(x: number, y: number): number {
  return fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y));
}

/** Hash-based white noise in [0, 1) — stable per pixel. */
export function whiteNoise01(x: number, y: number, channel: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + channel * 45.164) * 43758.5453;
  return fract(n);
}

export interface DebandOptions {
  mode: StillDebandMode;
  /** 0–1; default 0.35 → about ±1.0 code values at 8-bit. */
  strength?: number;
  /**
   * When true, noise is applied once to luminance and added to RGB equally
   * (less color freckling). Default true for blue-noise.
   */
  luminanceOnly?: boolean;
}

/**
 * Apply quantization dither to raw 8-bit RGBA (or RGB) buffer.
 * channels: 3 or 4. Does nothing when mode is `none` or strength ≤ 0.
 */
export function debandRaw(
  data: Buffer,
  width: number,
  height: number,
  channels: 3 | 4,
  opts: DebandOptions,
): Buffer {
  if (opts.mode === "none") return data;
  const strength = Math.min(1, Math.max(0, opts.strength ?? 0.35));
  if (strength <= 0) return data;

  // Amplitude in 8-bit code values (0–255). strength 1 ≈ ±3.0 levels.
  const amp = strength * 3;
  const luminanceOnly =
    opts.luminanceOnly ?? opts.mode === "blue-noise";

  const out = Buffer.from(data);
  const row = width * channels;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * row + x * channels;
      let n: number;
      if (opts.mode === "blue-noise") {
        n = interleavedGradientNoise(x, y) - 0.5;
      } else {
        n = whiteNoise01(x, y, 0) - 0.5;
      }
      const delta = n * 2 * amp;

      if (luminanceOnly) {
        for (let c = 0; c < 3 && c < channels; c++) {
          const v = out[i + c]! + delta;
          out[i + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
      } else {
        for (let c = 0; c < 3 && c < channels; c++) {
          const nc =
            opts.mode === "white-noise"
              ? (whiteNoise01(x, y, c) - 0.5) * 2 * amp
              : delta;
          const v = out[i + c]! + nc;
          out[i + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
      }
    }
  }
  return out;
}
