/**
 * Multi-segment interpolation for SuperImg animations
 *
 * Maps a progress value through multiple keyframes, like Remotion's interpolate().
 * Supports arbitrary input ranges (not just 0-1) and per-segment easing.
 *
 * @example
 * ```ts
 * // Fade in, hold, fade out
 * const opacity = std.interpolate(sceneProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
 *
 * // Color transition through multiple stops
 * const bg = std.interpolateColor(sceneProgress, [0, 0.5, 1], ["#f00", "#0f0", "#00f"]);
 * ```
 */

import { clamp01 } from "./easing";
import { lerp, inverseLerp } from "./math";
import { tween, type EasingName, type EasingFn } from "./tween";
import { colord, extend } from "colord";
import mixPlugin from "colord/plugins/mix";

extend([mixPlugin]);

export interface InterpolateOptions {
  /** Easing applied per segment. Default: linear */
  easing?: EasingName | EasingFn;
  /** Behavior outside input range. Default: "clamp" */
  extrapolate?: "clamp" | "extend";
  /** Override extrapolate for values below input range */
  extrapolateLeft?: "clamp" | "extend";
  /** Override extrapolate for values above input range */
  extrapolateRight?: "clamp" | "extend";
}

/**
 * Multi-segment numeric interpolation.
 *
 * Maps `progress` through paired input/output ranges. Each adjacent pair
 * of values defines a segment. Easing is applied per segment.
 *
 * @example
 * ```ts
 * // Linear ramp
 * std.interpolate(0.5, [0, 1], [0, 100])  // 50
 *
 * // Multi-segment: fade in, hold, fade out
 * std.interpolate(0.9, [0, 0.2, 0.8, 1], [0, 1, 1, 0])  // 0.5
 *
 * // With easing per segment
 * std.interpolate(0.5, [0, 1], [0, 100], { easing: "easeOutCubic" })
 * ```
 */
export function interpolate(
  progress: number,
  inputRange: number[],
  outputRange: number[],
  options?: InterpolateOptions,
): number {
  if (inputRange.length < 2) throw new Error("interpolate: inputRange must have at least 2 values");
  if (inputRange.length !== outputRange.length) {
    throw new Error("interpolate: inputRange and outputRange must have the same length");
  }

  const extLeft = options?.extrapolateLeft ?? options?.extrapolate ?? "clamp";
  const extRight = options?.extrapolateRight ?? options?.extrapolate ?? "clamp";

  // Below range
  if (progress <= inputRange[0]) {
    if (extLeft === "clamp") return outputRange[0];
    // Extend: extrapolate using first segment slope
    const segT = inverseLerp(inputRange[0], inputRange[1], progress);
    return applySegmentEasing(outputRange[0], outputRange[1], segT, options?.easing);
  }

  // Above range
  const last = inputRange.length - 1;
  if (progress >= inputRange[last]) {
    if (extRight === "clamp") return outputRange[last];
    // Extend: extrapolate using last segment slope
    const segT = inverseLerp(inputRange[last - 1], inputRange[last], progress);
    return applySegmentEasing(outputRange[last - 1], outputRange[last], segT, options?.easing);
  }

  // Find segment
  let i = 1;
  while (i < last && progress > inputRange[i]) i++;

  const segT = inverseLerp(inputRange[i - 1], inputRange[i], progress);
  return applySegmentEasing(outputRange[i - 1], outputRange[i], clamp01(segT), options?.easing);
}

function applySegmentEasing(
  from: number,
  to: number,
  t: number,
  easing: EasingName | EasingFn | undefined,
): number {
  if (!easing) return lerp(from, to, t);
  return tween(from, to, t, easing);
}

/**
 * Multi-segment color interpolation.
 *
 * Maps `progress` through paired input ranges and color stops.
 * Interpolates in RGB color space using colord.
 *
 * @example
 * ```ts
 * // Two-stop gradient
 * std.interpolateColor(0.5, [0, 1], ["#ff0000", "#0000ff"])
 *
 * // Multi-stop: red → green → blue
 * std.interpolateColor(0.25, [0, 0.5, 1], ["#ff0000", "#00ff00", "#0000ff"])
 * ```
 */
export function interpolateColor(
  progress: number,
  inputRange: number[],
  colors: string[],
  options?: Pick<InterpolateOptions, "easing">,
): string {
  if (inputRange.length < 2) throw new Error("interpolateColor: inputRange must have at least 2 values");
  if (inputRange.length !== colors.length) {
    throw new Error("interpolateColor: inputRange and colors must have the same length");
  }

  // Clamp to range
  const last = inputRange.length - 1;
  if (progress <= inputRange[0]) return colors[0];
  if (progress >= inputRange[last]) return colors[last];

  // Find segment
  let i = 1;
  while (i < last && progress > inputRange[i]) i++;

  let segT = inverseLerp(inputRange[i - 1], inputRange[i], progress);
  segT = clamp01(segT);

  // Apply easing to segment progress
  if (options?.easing) {
    segT = tween(0, 1, segT, options.easing);
  }

  // Interpolate colors via colord mix
  return colord(colors[i - 1]).mix(colors[i], segT).toHex();
}
