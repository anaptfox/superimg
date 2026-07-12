/**
 * Motion tone presets — premium / playful / broadcast / social.
 * Used by director({ tone }) and std.motion.style().
 */

import type { SpringName } from "./spring.js";
import type { EasingName } from "./easing.js";

export type MotionTone = "premium" | "playful" | "broadcast" | "social";

export type MotionToneEasing = EasingName | SpringName;

export interface MotionTonePreset {
  enterEasing: MotionToneEasing;
  exitEasing: MotionToneEasing;
  enter: {
    y?: number;
    scale?: number;
    blur?: number;
    fromOpacity?: number;
  };
  /** Exit duration multiplier inverse: 1.25 → exit ~20% shorter. */
  exitSpeed: number;
  stagger: { eachMs: number; capMs: number };
  overshoot: boolean;
}

export const MOTION_TONES: Record<MotionTone, MotionTonePreset> = {
  premium: {
    enterEasing: "easeInOutCubic",
    exitEasing: "easeInCubic",
    enter: { y: 16, fromOpacity: 0 },
    exitSpeed: 1.25,
    stagger: { eachMs: 50, capMs: 400 },
    overshoot: false,
  },
  playful: {
    enterEasing: "playful",
    exitEasing: "easeInCubic",
    enter: { y: 28, scale: 0.92, fromOpacity: 0 },
    exitSpeed: 1.3,
    stagger: { eachMs: 60, capMs: 500 },
    overshoot: true,
  },
  broadcast: {
    enterEasing: "easeOutCubic",
    exitEasing: "easeInCubic",
    enter: { y: 12, fromOpacity: 0 },
    exitSpeed: 1.2,
    stagger: { eachMs: 40, capMs: 350 },
    overshoot: false,
  },
  social: {
    enterEasing: "easeOutExpo",
    exitEasing: "easeInQuart",
    enter: { y: 32, scale: 0.94, fromOpacity: 0 },
    exitSpeed: 1.35,
    stagger: { eachMs: 45, capMs: 450 },
    overshoot: false,
  },
};

export function getMotionTone(tone: MotionTone): MotionTonePreset {
  const t = MOTION_TONES[tone];
  if (!t) {
    throw new Error(
      `Unknown motion tone "${tone}". Known: ${Object.keys(MOTION_TONES).join(", ")}`,
    );
  }
  return t;
}

/** Motion opts bag for d.motion(std.motion.style("premium", { y: 28 })). */
export interface MotionStyleOpts {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  fromOpacity?: number;
  easing?: MotionToneEasing;
  exitEasing?: MotionToneEasing;
}

export function motionStyle(
  tone: MotionTone,
  overrides?: MotionStyleOpts,
): MotionStyleOpts {
  const t = getMotionTone(tone);
  return {
    y: t.enter.y,
    scale: t.enter.scale,
    blur: t.enter.blur,
    fromOpacity: t.enter.fromOpacity ?? 0,
    easing: t.enterEasing,
    exitEasing: t.exitEasing,
    ...overrides,
  };
}

/** Namespace for `std.motion`. */
export const motion = {
  style: motionStyle,
  tones: MOTION_TONES,
  getTone: getMotionTone,
} as const;
