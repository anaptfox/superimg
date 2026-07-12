/**
 * Multi-parameter progress windows — Manim ValueTracker analogue.
 *
 * Prefer `ctx.director().tween` for single values tied to named phases.
 * Use tracker when several independent 0–1 channels share one global progress.
 */

import { clamp01 } from "../easing.js";
import * as easings from "../easing.js";
import type { EasingFn, EasingName } from "../easing.js";

type TrackerWindows<K extends string> = Record<K, [number, number]>;
type Tracker<K extends string> = { [key in K]: number };

const EASING_MAP = easings as unknown as Record<string, EasingFn>;

export interface TrackerOpts {
  /** Easing for each window's local progress. Default easeInOutCubic. */
  easing?: EasingName | EasingFn;
}

function defaultEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Map global progress into eased 0–1 per named window.
 *
 * @example
 * const t = std.viz.tracker(timeline.progress, {
 *   intro: [0, 0.2],
 *   race: [0.2, 0.85],
 *   outro: [0.85, 1],
 * });
 * // t.race is 0→1 during the race window
 *
 * // Director-aligned alternative for one value:
 * // const race = d.tween(0, 1, { during: "race" });
 */
export function tracker<K extends string>(
  progress: number,
  windows: TrackerWindows<K>,
  opts: TrackerOpts = {},
): Tracker<K> {
  const easeOpt = opts.easing;
  const easeFn: EasingFn =
    typeof easeOpt === "function"
      ? easeOpt
      : easeOpt
        ? (EASING_MAP[easeOpt] ?? defaultEase)
        : defaultEase;

  const result = {} as Tracker<K>;
  for (const key in windows) {
    const [start, end] = windows[key];
    const span = end - start;
    const raw = span <= 0 ? 1 : (progress - start) / span;
    result[key as K] = easeFn(clamp01(raw));
  }
  return result;
}
