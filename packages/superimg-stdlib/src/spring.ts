/**
 * Spring physics for SuperImg animations
 *
 * Analytical damped harmonic oscillator mapped to 0-1 progress.
 * Returns values that overshoot and settle, creating organic motion.
 *
 * @example
 * ```ts
 * // As a standalone curve
 * const val = std.spring(sceneProgress); // 0→overshoot→1
 *
 * // Interpolate with spring physics
 * const x = std.springTween(0, 500, sceneProgress, { stiffness: 200, damping: 8 });
 *
 * // As an easing function for tween()
 * const bounce = std.createSpring({ stiffness: 200, damping: 8 });
 * const y = std.tween(0, 100, sceneProgress, bounce);
 * ```
 */

import { clamp01 } from "./easing";
import { lerp } from "./math";

export interface SpringConfig {
  /** Spring constant — higher = faster oscillation. Default: 100 */
  stiffness?: number;
  /** Friction — lower = more bouncy. Default: 10 */
  damping?: number;
  /** Mass — higher = slower, more momentum. Default: 1 */
  mass?: number;
}

/**
 * Spring easing curve: maps progress 0-1 to a spring-animated 0→1 value.
 *
 * With default config, overshoots ~1.15 before settling to 1.0.
 * Lower damping = more bounce. Higher stiffness = faster oscillation.
 */
export function spring(progress: number, config?: SpringConfig): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const stiffness = config?.stiffness ?? 100;
  const damping = config?.damping ?? 10;
  const mass = config?.mass ?? 1;

  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  // Compute settling time: when envelope drops below epsilon
  const epsilon = 0.001;
  const settleTime =
    zeta >= 1
      ? -Math.log(epsilon) / (zeta * omega)
      : -Math.log(epsilon) / (zeta * omega);

  // Map 0-1 progress to virtual time
  const t = progress * settleTime;

  if (zeta < 1) {
    // Underdamped — oscillates
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * Math.cos(omegaD * t);
  } else if (zeta === 1) {
    // Critically damped — fastest non-oscillating
    return 1 - (1 + omega * t) * Math.exp(-omega * t);
  } else {
    // Overdamped — slow exponential decay, no oscillation
    const s1 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
    const s2 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
    // Coefficients from initial conditions: x(0)=0, x'(0) chosen for x(∞)=1
    const c2 = s1 / (s1 - s2);
    const c1 = 1 - c2;
    return 1 - c1 * Math.exp(s1 * t) - c2 * Math.exp(s2 * t);
  }
}

/**
 * Interpolate between two values using spring physics.
 *
 * @example
 * ```ts
 * const scale = std.springTween(0.8, 1, sceneProgress, { stiffness: 200, damping: 8 });
 * ```
 */
export function springTween(
  from: number,
  to: number,
  progress: number,
  config?: SpringConfig,
): number {
  return lerp(from, to, spring(progress, config));
}

/**
 * Create a spring easing function for use with `std.tween()`.
 *
 * @example
 * ```ts
 * const bounce = std.createSpring({ stiffness: 200, damping: 8 });
 * const x = std.tween(0, 500, sceneProgress, bounce);
 * ```
 */
export function createSpring(config?: SpringConfig): (t: number) => number {
  return (t: number) => spring(t, config);
}
