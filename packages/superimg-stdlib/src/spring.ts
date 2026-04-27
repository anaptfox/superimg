/**
 * Spring physics interpolation for SuperImg animations.
 *
 * Single entry point: `spring(from, to, progress, config?)` returns an
 * interpolated value driven by an analytical damped harmonic oscillator.
 *
 * For score-based animations, use `easing: "spring"` or
 * `easing: "spring(stiffness,damping)"` on `t.motion()` / `t.tween()`.
 *
 * @example
 * ```ts
 * const x = std.spring(0, 500, sceneProgress, { stiffness: 200, damping: 8 });
 * ```
 */

import { lerp } from "./math";

export interface SpringConfig {
  /** Spring constant — higher = faster oscillation. Default: 100 */
  stiffness?: number;
  /** Friction — lower = more bouncy. Default: 10 */
  damping?: number;
  /** Mass — higher = slower, more momentum. Default: 1 */
  mass?: number;
}

/** Map 0..1 progress to a spring-driven 0..1 curve (overshoots, then settles). */
function springCurve(progress: number, config?: SpringConfig): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const stiffness = config?.stiffness ?? 100;
  const damping = config?.damping ?? 10;
  const mass = config?.mass ?? 1;

  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const epsilon = 0.001;
  const settleTime = -Math.log(epsilon) / (zeta * omega);
  const t = progress * settleTime;

  if (zeta < 1) {
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * Math.cos(omegaD * t);
  }
  if (zeta === 1) {
    return 1 - (1 + omega * t) * Math.exp(-omega * t);
  }
  const s1 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
  const s2 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
  const c2 = s1 / (s1 - s2);
  const c1 = 1 - c2;
  return 1 - c1 * Math.exp(s1 * t) - c2 * Math.exp(s2 * t);
}

/**
 * Interpolate between two values using spring physics.
 *
 * @example
 * ```ts
 * const scale = std.spring(0.8, 1, sceneProgress, { stiffness: 200, damping: 8 });
 * ```
 */
export function spring(
  from: number,
  to: number,
  progress: number,
  config?: SpringConfig,
): number {
  return lerp(from, to, springCurve(progress, config));
}
