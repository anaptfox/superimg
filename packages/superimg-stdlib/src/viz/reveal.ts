/**
 * Shared reveal / lag progress helpers for explainer motion.
 * Pure functions of global progress — same math as Manim lag_ratio / get_sub_alpha.
 */

import { clamp01 } from "../easing.js";

export interface RevealOpts {
  /** Global progress 0–1 */
  progress: number;
  /**
   * Lag ratio across siblings (0 = all together, 1 = fully sequential).
   * Same idea as Manim Animation.lag_ratio.
   */
  lag?: number;
  /** Optional remap window on global progress */
  start?: number;
  end?: number;
}

/**
 * Map global progress into a local 0–1 for item `index` of `count`,
 * with lag_ratio-style staggering that does not lengthen total duration.
 *
 * Manim formula: fullLength = (n-1)*lag + 1; local = global*fullLength - index*lag
 */
export function lagProgress(
  progress: number,
  index: number,
  count: number,
  lagRatio = 0,
): number {
  if (count <= 0) return 0;
  if (count === 1 || lagRatio <= 0) return clamp01(progress);
  const i = Math.max(0, Math.min(count - 1, index));
  const lag = Math.max(0, Math.min(1, lagRatio));
  const fullLength = (count - 1) * lag + 1;
  return clamp01(progress * fullLength - i * lag);
}

/** Remap progress into [start, end] then clamp. */
export function revealWindow(progress: number, start = 0, end = 1): number {
  if (start >= end) return progress >= start ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

/**
 * Local progress for one of many revealed items under shared RevealOpts.
 */
export function revealLocal(
  opts: RevealOpts,
  index: number,
  count: number,
): number {
  const p = revealWindow(opts.progress, opts.start ?? 0, opts.end ?? 1);
  return lagProgress(p, index, count, opts.lag ?? 0);
}

/**
 * Stroke-draw attrs for multiple path lengths with lag.
 * Returns array of { strokeDasharray, strokeDashoffset } for each length.
 */
export function multiPathDraw(
  lengths: readonly number[],
  progress: number,
  opts?: { lag?: number; start?: number; end?: number },
): Array<{ strokeDasharray: string; strokeDashoffset: string }> {
  const count = lengths.length;
  return lengths.map((len, i) => {
    const local = revealLocal(
      {
        progress,
        lag: opts?.lag ?? 0.15,
        start: opts?.start,
        end: opts?.end,
      },
      i,
      count,
    );
    const L = Math.max(0, len);
    const offset = L * (1 - local);
    return {
      strokeDasharray: `${Math.round(L * 1000) / 1000}`,
      strokeDashoffset: `${Math.round(offset * 1000) / 1000}`,
    };
  });
}
