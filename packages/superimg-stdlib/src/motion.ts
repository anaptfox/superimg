/**
 * Motion utilities for SuperImg templates
 *
 * High-level animation primitives that combine opacity, transform, and CSS generation
 * into single calls. These replace the common pattern of multiple tween calls + manual
 * style string construction.
 *
 * @example
 * ```ts
 * // Before (4 lines):
 * const opacity = std.tween(0, 1, progress, "easeOutCubic");
 * const y = std.tween(-20, 0, progress, "easeOutCubic");
 * style="${std.css({ opacity, transform: `translateY(${y}px)` })}"
 *
 * // After (1 line):
 * style="${std.motion.enter(progress, { y: -20 }).style}"
 * ```
 */

import { tween, type EasingName } from "./tween";
import { css } from "./css";
import { clamp01 } from "./easing";

/** Result of a motion calculation */
export interface MotionResult {
  /** Opacity value (0-1) */
  opacity: number;
  /** X translation in pixels */
  x: number;
  /** Y translation in pixels */
  y: number;
  /** Scale factor (1 = no scale) */
  scale: number;
  /** CSS transform string (e.g., "translateY(20px) scale(0.95)") */
  transform: string;
  /** Complete inline style string (opacity + transform) */
  style: string;
}

/** Options for motion functions */
export interface MotionOptions {
  /** Y translation offset in pixels (default: 20) */
  y?: number;
  /** X translation offset in pixels (default: 0) */
  x?: number;
  /** Scale offset from 1 (default: 0, meaning scale starts/ends at 1) */
  scale?: number;
  /** Easing function name (default: "easeOutCubic") */
  easing?: EasingName;
}

/** Options for enterExit, extending MotionOptions */
export interface EnterExitOptions extends MotionOptions {
  /** Progress value where enter phase ends (default: 0.33) */
  enterEnd?: number;
  /** Progress value where exit phase starts (default: 0.66) */
  exitStart?: number;
}

function buildTransform(x: number, y: number, scale: number): string {
  const parts: string[] = [];
  if (x !== 0) parts.push(`translateX(${x}px)`);
  if (y !== 0) parts.push(`translateY(${y}px)`);
  if (scale !== 1) parts.push(`scale(${scale})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

function buildStyle(opacity: number, transform: string): string {
  const styles: Record<string, unknown> = { opacity };
  if (transform !== "none") {
    styles.transform = transform;
  }
  return css(styles);
}

/**
 * Calculate enter animation values (fade in + slide from offset).
 *
 * @param progress - Animation progress (0-1)
 * @param options - Animation options (y, x, scale, easing)
 * @returns MotionResult with all animation values and pre-built styles
 *
 * @example
 * ```ts
 * // Fade in from below
 * const { style } = std.motion.enter(progress, { y: 30 });
 *
 * // Fade in from left with scale
 * const { opacity, transform } = std.motion.enter(progress, { x: -50, scale: 0.1 });
 * ```
 */
export function enter(progress: number, options?: MotionOptions): MotionResult {
  const {
    y: yOffset = 20,
    x: xOffset = 0,
    scale: scaleOffset = 0,
    easing = "easeOutCubic",
  } = options ?? {};

  const t = clamp01(progress);
  const opacity = tween(0, 1, t, easing);
  const y = tween(yOffset, 0, t, easing);
  const x = tween(xOffset, 0, t, easing);
  const scale = tween(1 - scaleOffset, 1, t, easing);
  const transform = buildTransform(x, y, scale);
  const style = buildStyle(opacity, transform);

  return { opacity, x, y, scale, transform, style };
}

/**
 * Calculate exit animation values (fade out + slide to offset).
 *
 * @param progress - Animation progress (0-1)
 * @param options - Animation options (y, x, scale, easing)
 * @returns MotionResult with all animation values and pre-built styles
 *
 * @example
 * ```ts
 * // Fade out upward
 * const { style } = std.motion.exit(progress, { y: -30 });
 *
 * // Fade out to right
 * const { opacity } = std.motion.exit(progress, { x: 50 });
 * ```
 */
export function exit(progress: number, options?: MotionOptions): MotionResult {
  const {
    y: yOffset = -20,
    x: xOffset = 0,
    scale: scaleOffset = 0,
    easing = "easeInCubic",
  } = options ?? {};

  const t = clamp01(progress);
  const opacity = tween(1, 0, t, easing);
  const y = tween(0, yOffset, t, easing);
  const x = tween(0, xOffset, t, easing);
  const scale = tween(1, 1 - scaleOffset, t, easing);
  const transform = buildTransform(x, y, scale);
  const style = buildStyle(opacity, transform);

  return { opacity, x, y, scale, transform, style };
}

/**
 * Calculate enter-hold-exit animation values.
 *
 * Splits progress into three phases:
 * - Enter (0 → enterEnd): fade in + slide from offset
 * - Hold (enterEnd → exitStart): fully visible, no animation
 * - Exit (exitStart → 1): fade out + slide to offset
 *
 * @param progress - Overall animation progress (0-1)
 * @param options - Animation options including phase boundaries
 * @returns MotionResult with combined animation values
 *
 * @example
 * ```ts
 * // Default timing (33% enter, 34% hold, 33% exit)
 * const { style } = std.motion.enterExit(progress, { y: 40 });
 *
 * // Custom timing (20% enter, 60% hold, 20% exit)
 * const { opacity } = std.motion.enterExit(progress, {
 *   y: 30,
 *   enterEnd: 0.2,
 *   exitStart: 0.8
 * });
 * ```
 */
export function enterExit(
  progress: number,
  options?: EnterExitOptions
): MotionResult {
  const {
    y: yOffset = 20,
    x: xOffset = 0,
    scale: scaleOffset = 0,
    easing = "easeOutCubic",
    enterEnd = 0.33,
    exitStart = 0.66,
  } = options ?? {};

  const t = clamp01(progress);

  // Calculate phase progress
  let enterProgress = 0;
  let exitProgress = 0;

  if (t < enterEnd) {
    // Enter phase
    enterProgress = t / enterEnd;
  } else if (t >= exitStart) {
    // Exit phase
    exitProgress = (t - exitStart) / (1 - exitStart);
  }
  // Hold phase: both stay at 0

  // Enter animation
  const enterOpacity = tween(0, 1, clamp01(enterProgress), easing);
  const enterY = tween(yOffset, 0, clamp01(enterProgress), easing);
  const enterX = tween(xOffset, 0, clamp01(enterProgress), easing);
  const enterScale = tween(1 - scaleOffset, 1, clamp01(enterProgress), easing);

  // Exit animation (use easeIn for exit)
  const exitEasing: EasingName = easing.includes("Out")
    ? (easing.replace("Out", "In") as EasingName)
    : "easeInCubic";
  const exitOpacity = tween(1, 0, clamp01(exitProgress), exitEasing);
  const exitY = tween(0, -yOffset, clamp01(exitProgress), exitEasing);
  const exitX = tween(0, -xOffset, clamp01(exitProgress), exitEasing);
  const exitScale = tween(1, 1 - scaleOffset, clamp01(exitProgress), exitEasing);

  // Combine: multiply opacity, add transforms
  const opacity = enterOpacity * exitOpacity;
  const y = enterY + exitY;
  const x = enterX + exitX;
  const scale = enterScale * exitScale;

  const transform = buildTransform(x, y, scale);
  const style = buildStyle(opacity, transform);

  return { opacity, x, y, scale, transform, style };
}
