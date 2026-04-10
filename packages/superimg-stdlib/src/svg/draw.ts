/**
 * SVG stroke drawing (line reveal) animation.
 *
 * Returns stroke-dasharray and stroke-dashoffset values
 * for animating an SVG path being "drawn" from start to end.
 *
 * @example
 * ```ts
 * const d = "M10,80 Q95,10 180,80";
 * const draw = std.svg.draw(d, sceneProgress);
 * return `<path d="${d}" fill="none" stroke="white" stroke-width="3"
 *           stroke-dasharray="${draw.strokeDasharray}"
 *           stroke-dashoffset="${draw.strokeDashoffset}" />`;
 * ```
 */

import { normalizePath } from "./segments";
import type { EasingName, EasingFn } from "../tween";
import { clamp01 } from "../easing";
import * as easing from "../easing";

const EASING_MAP: Record<string, EasingFn> = easing as unknown as Record<string, EasingFn>;

export interface DrawResult {
  /** Value for SVG stroke-dasharray attribute */
  strokeDasharray: string;
  /** Value for SVG stroke-dashoffset attribute */
  strokeDashoffset: string;
}

export interface DrawOptions {
  /** Start of drawing window (0-1). Default: 0 */
  start?: number;
  /** End of drawing window (0-1). Default: 1 */
  end?: number;
  /** Easing applied to progress. Default: linear */
  easing?: EasingName | EasingFn;
}

export function draw(d: string, progress: number, opts?: DrawOptions): DrawResult {
  const { totalLength } = normalizePath(d);

  const start = opts?.start ?? 0;
  const end = opts?.end ?? 1;

  // Remap progress to the [start, end] window
  let t: number;
  if (start >= end) {
    t = progress >= start ? 1 : 0;
  } else {
    t = (progress - start) / (end - start);
    t = clamp01(t);
  }

  // Apply easing
  const easingOpt = opts?.easing;
  if (easingOpt) {
    const fn = typeof easingOpt === "function" ? easingOpt : EASING_MAP[easingOpt];
    if (fn) t = fn(t);
  }

  const offset = totalLength * (1 - t);
  return {
    strokeDasharray: `${Math.round(totalLength * 1000) / 1000}`,
    strokeDashoffset: `${Math.round(offset * 1000) / 1000}`,
  };
}
