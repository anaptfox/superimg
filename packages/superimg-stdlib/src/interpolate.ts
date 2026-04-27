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

/**
 * Multi-segment numeric interpolation.
 *
 * Maps `progress` through paired input/output ranges. Each adjacent pair
 * of values defines a segment. Values outside the input range clamp to the
 * nearest endpoint. Easing is applied per segment.
 *
 * @example
 * ```ts
 * // Linear ramp
 * std.interpolate(0.5, [0, 1], [0, 100])  // 50
 *
 * // Multi-segment: fade in, hold, fade out
 * std.interpolate(0.9, [0, 0.2, 0.8, 1], [0, 1, 1, 0])  // 0.5
 *
 * // With easing
 * std.interpolate(0.5, [0, 1], [0, 100], "easeOutCubic")
 * ```
 */
export function interpolate(
  progress: number,
  inputRange: number[],
  outputRange: number[],
  easing?: EasingName | EasingFn,
): number {
  if (inputRange.length < 2) throw new Error("interpolate: inputRange must have at least 2 values");
  if (inputRange.length !== outputRange.length) {
    throw new Error("interpolate: inputRange and outputRange must have the same length");
  }

  const last = inputRange.length - 1;
  if (progress <= inputRange[0]) return outputRange[0];
  if (progress >= inputRange[last]) return outputRange[last];

  let i = 1;
  while (i < last && progress > inputRange[i]) i++;

  const segT = clamp01(inverseLerp(inputRange[i - 1], inputRange[i], progress));
  if (!easing) return lerp(outputRange[i - 1], outputRange[i], segT);
  return tween(outputRange[i - 1], outputRange[i], segT, easing);
}

/**
 * Multi-segment color interpolation.
 *
 * Maps `progress` through paired input ranges and color stops.
 * Interpolates in RGB color space using colord. Values outside the input
 * range clamp to the nearest color.
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
  easing?: EasingName | EasingFn,
): string {
  if (inputRange.length < 2) throw new Error("interpolateColor: inputRange must have at least 2 values");
  if (inputRange.length !== colors.length) {
    throw new Error("interpolateColor: inputRange and colors must have the same length");
  }

  const last = inputRange.length - 1;
  if (progress <= inputRange[0]) return colors[0];
  if (progress >= inputRange[last]) return colors[last];

  let i = 1;
  while (i < last && progress > inputRange[i]) i++;

  let segT = clamp01(inverseLerp(inputRange[i - 1], inputRange[i], progress));
  if (easing) segT = tween(0, 1, segT, easing);

  return colord(colors[i - 1]).mix(colors[i], segT).toHex();
}
