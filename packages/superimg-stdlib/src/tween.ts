/**
 * Tween utilities for SuperImg animations
 *
 * Composes easing + interpolation into a single call.
 */

import { clamp01 } from "./easing";
import * as easing from "./easing";
import { lerp } from "./math";

/** Easing function: takes t in [0,1], returns eased value */
export type EasingFn = (t: number) => number;

/** Named easing keys supported by tween */
export const EASING_NAMES = [
  "linear",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeInSine",
  "easeOutSine",
  "easeInOutSine",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuart",
  "easeOutQuart",
  "easeInOutQuart",
  "easeInQuint",
  "easeOutQuint",
  "easeInOutQuint",
  "easeInExpo",
  "easeOutExpo",
  "easeInOutExpo",
  "easeInCirc",
  "easeOutCirc",
  "easeInOutCirc",
  "easeInBack",
  "easeOutBack",
  "easeInOutBack",
  "easeInElastic",
  "easeOutElastic",
  "easeInOutElastic",
  "easeInBounce",
  "easeOutBounce",
  "easeInOutBounce",
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

const EASING_MAP: Record<EasingName, EasingFn> = {
  linear: easing.linear,
  easeInQuad: easing.easeInQuad,
  easeOutQuad: easing.easeOutQuad,
  easeInOutQuad: easing.easeInOutQuad,
  easeInSine: easing.easeInSine,
  easeOutSine: easing.easeOutSine,
  easeInOutSine: easing.easeInOutSine,
  easeInCubic: easing.easeInCubic,
  easeOutCubic: easing.easeOutCubic,
  easeInOutCubic: easing.easeInOutCubic,
  easeInQuart: easing.easeInQuart,
  easeOutQuart: easing.easeOutQuart,
  easeInOutQuart: easing.easeInOutQuart,
  easeInQuint: easing.easeInQuint,
  easeOutQuint: easing.easeOutQuint,
  easeInOutQuint: easing.easeInOutQuint,
  easeInExpo: easing.easeInExpo,
  easeOutExpo: easing.easeOutExpo,
  easeInOutExpo: easing.easeInOutExpo,
  easeInCirc: easing.easeInCirc,
  easeOutCirc: easing.easeOutCirc,
  easeInOutCirc: easing.easeInOutCirc,
  easeInBack: easing.easeInBack,
  easeOutBack: easing.easeOutBack,
  easeInOutBack: easing.easeInOutBack,
  easeInElastic: easing.easeInElastic,
  easeOutElastic: easing.easeOutElastic,
  easeInOutElastic: easing.easeInOutElastic,
  easeInBounce: easing.easeInBounce,
  easeOutBounce: easing.easeOutBounce,
  easeInOutBounce: easing.easeInOutBounce,
};

export interface TweenOptions {
  /** Easing name or function. Default: linear */
  easing?: EasingName | EasingFn;
  /** Start of animation window (0-1). Progress before this returns `from`. Default: 0 */
  start?: number;
  /** End of animation window (0-1). Progress after this returns `to`. Default: 1 */
  end?: number;
}

function resolveEasing(easingOpt: EasingName | EasingFn | undefined): EasingFn {
  if (easingOpt === undefined) return easing.linear;
  if (typeof easingOpt === "function") return easingOpt;
  const fn = EASING_MAP[easingOpt as EasingName];
  if (!fn) {
    throw new Error(
      `Unknown easing "${easingOpt}". Valid names: ${EASING_NAMES.join(", ")}`
    );
  }
  return fn;
}

/**
 * Interpolate from `from` to `to` with optional easing and time window.
 *
 * @param from - Start value
 * @param to - End value
 * @param progress - Progress in [0, 1] (or use options.start/end to remap)
 * @param easingOrOptions - Easing name, easing function, or options object
 * @returns Interpolated value
 *
 * @example
 * ```ts
 * // Simple: linear interpolation
 * std.tween(0, 100, 0.5)  // 50
 *
 * // With easing
 * std.tween(0, 100, 0.5, 'easeOutCubic')  // ~87.5
 *
 * // With time window (animate only between 20% and 60% of scene)
 * std.tween(0, 100, sceneProgress, { easing: 'easeOutCubic', start: 0.2, end: 0.6 })
 * ```
 */
export function tween(
  from: number,
  to: number,
  progress: number,
  easingOrOptions?: EasingName | EasingFn | TweenOptions
): number {
  let start = 0;
  let end = 1;
  let easingFn: EasingFn = easing.linear;

  if (easingOrOptions === undefined) {
    // linear, full range [0, 1]
  } else if (
    typeof easingOrOptions === "string" ||
    typeof easingOrOptions === "function"
  ) {
    easingFn = resolveEasing(easingOrOptions as EasingName | EasingFn);
  } else {
    const opts = easingOrOptions as TweenOptions;
    start = opts.start ?? 0;
    end = opts.end ?? 1;
    if (start > end) {
      throw new Error(
        `tween options: start (${start}) must be <= end (${end})`
      );
    }
    easingFn = resolveEasing(opts.easing);
  }

  // Remap progress to [0,1] within window; clamp
  let t: number;
  if (start === end) {
    t = progress >= start ? 1 : 0;
  } else {
    t = (progress - start) / (end - start);
    t = clamp01(t);
  }

  const eased = easingFn(t);
  return lerp(from, to, eased);
}
