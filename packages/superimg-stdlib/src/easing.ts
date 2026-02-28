/**
 * Easing functions for SuperImg animations
 *
 * All functions take a normalized time value `t` in the range [0, 1]
 * and return an eased value, typically also in [0, 1].
 *
 * @example
 * ```ts
 * import { easeOutCubic } from '@superimg/stdlib/easing';
 *
 * const progress = easeOutCubic(0.5); // 0.875
 * ```
 */

/**
 * Clamp a value to the range [0, 1]
 */
export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * Linear easing (no easing, identity function).
 * @ai-hint Use for constant-speed movement or when easing is applied elsewhere.
 * @param t - Normalized time in [0, 1] (clamped internally)
 * @returns The clamped input value
 */
export function linear(t: number): number {
  return clamp01(t);
}

// ============================================================================
// Cubic Family
// ============================================================================

/**
 * Cubic ease-in: slow start, accelerating toward the end.
 * @ai-hint Most common "speed up" curve. Output grows as t³.
 * @param t - Normalized time in [0, 1] (clamped internally)
 * @returns Eased value in [0, 1]
 */
export function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

/**
 * Cubic ease-out: fast start, decelerating toward the end.
 * @ai-hint Best default for entrance animations (fade-in, slide-in).
 * @param t - Normalized time in [0, 1] (clamped internally)
 * @returns Eased value in [0, 1]
 */
export function easeOutCubic(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

/**
 * Cubic ease-in-out: slow start and end, fast in the middle.
 * @ai-hint Good for looping animations or elements that enter and exit.
 * @param t - Normalized time in [0, 1] (clamped internally)
 * @returns Eased value in [0, 1]
 */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// ============================================================================
// Quart Family
// ============================================================================

export function easeInQuart(t: number): number {
  const x = clamp01(t);
  return x * x * x * x;
}

export function easeOutQuart(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x * x;
}

export function easeInOutQuart(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

// ============================================================================
// Exponential Family
// ============================================================================

export function easeInExpo(t: number): number {
  const x = clamp01(t);
  return x === 0 ? 0 : Math.pow(2, 10 * (x - 1));
}

export function easeOutExpo(t: number): number {
  const x = clamp01(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export function easeInOutExpo(t: number): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return x < 0.5
    ? Math.pow(2, 20 * x - 10) / 2
    : (2 - Math.pow(2, -20 * x + 10)) / 2;
}

// ============================================================================
// Back (Overshoot) Family
// ============================================================================

const BACK_C1 = 1.70158;
const BACK_C3 = BACK_C1 + 1;

export function easeInBack(t: number): number {
  const x = clamp01(t);
  const c3 = BACK_C3;
  return c3 * x * x * x - BACK_C1 * x * x;
}

export function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c3 = BACK_C3;
  return 1 + c3 * Math.pow(x - 1, 3) + BACK_C1 * Math.pow(x - 1, 2);
}

export function easeInOutBack(t: number): number {
  const x = clamp01(t);
  const c1 = BACK_C1;
  const c2 = c1 * 1.525;
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

// ============================================================================
// Elastic Family
// ============================================================================

const ELASTIC_C4 = (2 * Math.PI) / 3;

export function easeInElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * ELASTIC_C4);
}

export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ELASTIC_C4) + 1;
}

export function easeInOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return x < 0.5
    ? -(Math.pow(2, 20 * x - 10) * Math.sin(((20 * x - 11.125) * (2 * Math.PI)) / 4.5)) / 2
    : (Math.pow(2, -20 * x + 10) * Math.sin(((20 * x - 11.125) * (2 * Math.PI)) / 4.5)) / 2 + 1;
}

// ============================================================================
// Bounce Family
// ============================================================================

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

export function easeInBounce(t: number): number {
  const x = clamp01(t);
  return 1 - bounceOut(1 - x);
}

export function easeOutBounce(t: number): number {
  return bounceOut(clamp01(t));
}

export function easeInOutBounce(t: number): number {
  const x = clamp01(t);
  return x < 0.5
    ? (1 - bounceOut(1 - 2 * x)) / 2
    : (1 + bounceOut(2 * x - 1)) / 2;
}
