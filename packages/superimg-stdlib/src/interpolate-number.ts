import {
  clamp01,
  EASING_NAMES,
  type EasingFn,
  type EasingName,
} from "./easing.js";
import * as easingFunctions from "./easing.js";
import { inverseLerp, lerp } from "./math-basic.js";

/** Numeric interpolation without the optional color implementation. */
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
  const firstInput = inputRange[0]!;
  const lastInput = inputRange[last]!;
  const firstOutput = outputRange[0]!;
  const lastOutput = outputRange[last]!;
  if (progress <= firstInput) return firstOutput;
  if (progress >= lastInput) return lastOutput;

  let i = 1;
  while (i < last && progress > (inputRange[i] ?? lastInput)) i += 1;

  const inLo = inputRange[i - 1] ?? firstInput;
  const inHi = inputRange[i] ?? lastInput;
  const outLo = outputRange[i - 1] ?? firstOutput;
  const outHi = outputRange[i] ?? lastOutput;
  const segment = clamp01(inverseLerp(inLo, inHi, progress));
  const easingFn = typeof easing === "function"
    ? easing
    : easing === undefined
      ? undefined
      : (easingFunctions as unknown as Record<string, EasingFn>)[easing];
  if (easing !== undefined && !easingFn) {
    throw new Error(`Unknown easing "${easing}". Valid names: ${EASING_NAMES.join(", ")}`);
  }
  const eased = easingFn ? easingFn(segment) : segment;
  return lerp(outLo, outHi, eased);
}
