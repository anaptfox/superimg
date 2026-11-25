//! Director easing resolve + exit-mirror descriptors for Media IR.

import type { EasingFn } from "../easing.js";
import * as easing from "../easing.js";
import {
  type SpringConfig,
  isSpringName,
  resolveSpring,
  springCurve,
} from "../spring.js";
import type { MotionEasing } from "./types.js";

export const DEFAULT_ENTER_EASING: EasingFn = easing.easeOutCubic;
export const DEFAULT_EXIT_EASING: EasingFn = easing.easeInCubic;

const SHORTHAND_TO_CANONICAL: Record<string, string> = {
  inQuad: "easeInQuad",
  outQuad: "easeOutQuad",
  inOutQuad: "easeInOutQuad",
  inSine: "easeInSine",
  outSine: "easeOutSine",
  inOutSine: "easeInOutSine",
  inCubic: "easeInCubic",
  outCubic: "easeOutCubic",
  inOutCubic: "easeInOutCubic",
  inQuart: "easeInQuart",
  outQuart: "easeOutQuart",
  inOutQuart: "easeInOutQuart",
  inQuint: "easeInQuint",
  outQuint: "easeOutQuint",
  inOutQuint: "easeInOutQuint",
  inExpo: "easeInExpo",
  outExpo: "easeOutExpo",
  inOutExpo: "easeInOutExpo",
  inCirc: "easeInCirc",
  outCirc: "easeOutCirc",
  inOutCirc: "easeInOutCirc",
  inBack: "easeInBack",
  outBack: "easeOutBack",
  inOutBack: "easeInOutBack",
  inElastic: "easeInElastic",
  outElastic: "easeOutElastic",
  inOutElastic: "easeInOutElastic",
  inBounce: "easeInBounce",
  outBounce: "easeOutBounce",
  inOutBounce: "easeInOutBounce",
};

const NAMED_EASINGS: Record<string, EasingFn> = {
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
  // Shorthand aliases without "ease" prefix
  inQuad: easing.easeInQuad,
  outQuad: easing.easeOutQuad,
  inOutQuad: easing.easeInOutQuad,
  inSine: easing.easeInSine,
  outSine: easing.easeOutSine,
  inOutSine: easing.easeInOutSine,
  inCubic: easing.easeInCubic,
  outCubic: easing.easeOutCubic,
  inOutCubic: easing.easeInOutCubic,
  inQuart: easing.easeInQuart,
  outQuart: easing.easeOutQuart,
  inOutQuart: easing.easeInOutQuart,
  inQuint: easing.easeInQuint,
  outQuint: easing.easeOutQuint,
  inOutQuint: easing.easeInOutQuint,
  inExpo: easing.easeInExpo,
  outExpo: easing.easeOutExpo,
  inOutExpo: easing.easeInOutExpo,
  inCirc: easing.easeInCirc,
  outCirc: easing.easeOutCirc,
  inOutCirc: easing.easeInOutCirc,
  inBack: easing.easeInBack,
  outBack: easing.easeOutBack,
  inOutBack: easing.easeInOutBack,
  inElastic: easing.easeInElastic,
  outElastic: easing.easeOutElastic,
  inOutElastic: easing.easeInOutElastic,
  inBounce: easing.easeInBounce,
  outBounce: easing.easeOutBounce,
  inOutBounce: easing.easeInOutBounce,
  // Semantic craft aliases
  enter: easing.easeOutCubic,
  exit: easing.easeInCubic,
  move: easing.easeInOutCubic,
  loop: easing.linear,
};

const EXIT_MIRROR: Record<string, EasingFn> = {
  easeOutQuad: easing.easeInQuad,
  easeOutCubic: easing.easeInCubic,
  easeOutQuart: easing.easeInQuart,
  easeOutQuint: easing.easeInQuint,
  easeOutSine: easing.easeInSine,
  easeOutExpo: easing.easeInExpo,
  easeOutCirc: easing.easeInCirc,
  easeOutBack: easing.easeInQuad,
  easeOutElastic: easing.easeInQuad,
  easeOutBounce: easing.easeInQuad,
  easeInOutQuad: easing.easeInOutQuad,
  easeInOutCubic: easing.easeInOutCubic,
  easeInOutQuart: easing.easeInOutQuart,
  easeInOutSine: easing.easeInOutSine,
  easeInOutExpo: easing.easeInOutExpo,
  outQuad: easing.easeInQuad,
  outCubic: easing.easeInCubic,
  outQuart: easing.easeInQuart,
  outQuint: easing.easeInQuint,
  outSine: easing.easeInSine,
  outExpo: easing.easeInExpo,
  outCirc: easing.easeInCirc,
  outBack: easing.easeInQuad,
  outElastic: easing.easeInQuad,
  outBounce: easing.easeInQuad,
  inOutQuad: easing.easeInOutQuad,
  inOutCubic: easing.easeInOutCubic,
  inOutQuart: easing.easeInOutQuart,
  inOutSine: easing.easeInOutSine,
  inOutExpo: easing.easeInOutExpo,
  enter: easing.easeInCubic,
  exit: easing.easeInCubic,
  move: easing.easeInOutCubic,
  loop: easing.linear,
};

export type EasingDesc =
  | { kind: "named"; name: string }
  | { kind: "spring"; stiffness: number; damping: number; mass?: number };

export function resolveEasing(
  spec: MotionEasing | undefined,
  fallback: EasingFn,
): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "function") return spec;
  if (typeof spec === "object") return (t: number) => springCurve(t, resolveSpring(spec));
  if (typeof spec === "string" && isSpringName(spec)) {
    const cfg = resolveSpring(spec);
    return (t: number) => springCurve(t, cfg);
  }
  const fn = NAMED_EASINGS[spec as string];
  if (!fn) {
    throw new Error(
      `Unknown easing: "${spec}". Use a named curve, spring name (${Object.keys({ gentle: 1, snappy: 1, fluid: 1, playful: 1, wobbly: 1 }).join(", ")}), or semantic enter|exit|move|loop`,
    );
  }
  return fn;
}

export function easingDescriptor(spec: MotionEasing | undefined): EasingDesc | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === "function") {
    return { kind: "named", name: "custom-function" };
  }
  if (typeof spec === "object") {
    const s = resolveSpring(spec as SpringConfig);
    return { kind: "spring", stiffness: s.stiffness, damping: s.damping, mass: s.mass };
  }
  if (typeof spec === "string" && isSpringName(spec)) {
    const s = resolveSpring(spec);
    return { kind: "spring", stiffness: s.stiffness, damping: s.damping, mass: s.mass };
  }
  const rawName = String(spec);
  return { kind: "named", name: SHORTHAND_TO_CANONICAL[rawName] ?? rawName };
}

/** Descriptor of the *effective* exit easing after mirrorExitEasing rules. */
export function mirroredExitEasingDescriptor(
  spec: MotionEasing | undefined,
): EasingDesc | undefined {
  if (spec === undefined) return { kind: "named", name: "easeInCubic" };
  if (typeof spec === "function") {
    return { kind: "named", name: "custom-function" };
  }
  if (typeof spec === "object") {
    // Springs on exit → easeInCubic (no reverse overshoot)
    return { kind: "named", name: "easeInCubic" };
  }
  if (typeof spec === "string" && isSpringName(spec)) {
    return { kind: "named", name: "easeInCubic" };
  }
  const mirroredNames: Record<string, string> = {
    easeOutQuad: "easeInQuad",
    easeOutCubic: "easeInCubic",
    easeOutQuart: "easeInQuart",
    easeOutQuint: "easeInQuint",
    easeOutSine: "easeInSine",
    easeOutExpo: "easeInExpo",
    easeOutCirc: "easeInCirc",
    easeOutBack: "easeInQuad",
    easeOutElastic: "easeInQuad",
    easeOutBounce: "easeInQuad",
    easeInOutQuad: "easeInOutQuad",
    easeInOutCubic: "easeInOutCubic",
    easeInOutQuart: "easeInOutQuart",
    easeInOutSine: "easeInOutSine",
    easeInOutExpo: "easeInOutExpo",
    enter: "easeInCubic",
    exit: "easeInCubic",
    move: "easeInOutCubic",
    loop: "linear",
  };
  const rawName = String(spec);
  const name = SHORTHAND_TO_CANONICAL[rawName] ?? rawName;
  return { kind: "named", name: mirroredNames[name] ?? name };
}

export function mirrorExitEasing(
  spec: MotionEasing | undefined,
  fallback: EasingFn,
): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "string") {
    if (isSpringName(spec)) {
      // Springs on exit: use easeInCubic (no reverse overshoot)
      return DEFAULT_EXIT_EASING;
    }
    const mirrored = EXIT_MIRROR[spec];
    if (mirrored) return mirrored;
  }
  return resolveEasing(spec, fallback);
}
