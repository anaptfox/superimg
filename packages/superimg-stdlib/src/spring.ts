/**
 * Spring physics interpolation for SuperImg animations.
 *
 * Single entry point: `spring(from, to, progress, config?)` returns an
 * interpolated value driven by an analytical damped harmonic oscillator.
 *
 * Named presets encode craft defaults (critically damped by default).
 *
 * @example
 * ```ts
 * const x = std.spring(0, 500, p, "gentle");
 * d.motion({ scale: 0.92, easing: "playful" });
 * ```
 */

import { lerp } from "./math";

export interface SpringConfig {
  /** Spring constant — higher = faster oscillation. */
  stiffness?: number;
  /** Friction — lower = more bouncy. */
  damping?: number;
  /** Mass — higher = slower, more momentum. Default: 1 */
  mass?: number;
}

/** Named spring feels — omakase craft presets. */
export type SpringName = "gentle" | "snappy" | "fluid" | "playful" | "wobbly";

export type SpringSpec = SpringName | SpringConfig;

/** Critically damped / near-critical named springs (ζ ≈ 1 unless noted). */
export const SPRINGS: Record<SpringName, Required<SpringConfig>> = {
  /** Default: premium settle, no visible bounce (ζ ≈ 1). */
  gentle: { stiffness: 170, damping: 26, mass: 1 },
  /** Snappy UI settle, critically damped. */
  snappy: { stiffness: 380, damping: 39, mass: 1 },
  /** Balanced fluid settle — between gentle and snappy. */
  fluid: { stiffness: 210, damping: 29, mass: 1 },
  /** Soft overshoot — entrances only. */
  playful: { stiffness: 170, damping: 12, mass: 1 },
  /** Expressive wobble — rare. */
  wobbly: { stiffness: 180, damping: 8, mass: 1 },
};

const SPRING_NAMES = new Set<string>(Object.keys(SPRINGS));

export function isSpringName(value: string): value is SpringName {
  return SPRING_NAMES.has(value);
}

/**
 * Resolve a spring name or partial config to a full config.
 * Omitted config → `gentle` (critically damped).
 */
export function resolveSpring(
  spec?: SpringSpec,
  fallback: SpringName = "gentle",
): Required<SpringConfig> {
  if (spec == null) return { ...SPRINGS[fallback] };
  if (typeof spec === "string") {
    if (!isSpringName(spec)) {
      throw new Error(
        `Unknown spring "${spec}". Known: ${Object.keys(SPRINGS).join(", ")}`,
      );
    }
    return { ...SPRINGS[spec] };
  }
  const base = SPRINGS[fallback];
  return {
    stiffness: spec.stiffness ?? base.stiffness,
    damping: spec.damping ?? base.damping,
    mass: spec.mass ?? base.mass,
  };
}

/**
 * Map designer-friendly response + damping fraction to an analytic SpringConfig.
 * response ≈ settle feel in seconds; dampingFraction 1 = critical, &lt;1 bouncy.
 */
export function springFromResponse(opts?: {
  response?: number;
  dampingFraction?: number;
  mass?: number;
}): Required<SpringConfig> {
  const response = opts?.response ?? 0.4;
  const dampingFraction = opts?.dampingFraction ?? 1;
  const mass = opts?.mass ?? 1;
  // Heuristic: stiffness grows as response shrinks (snappier = stiffer).
  const stiffness = Math.max(40, mass * (2 * Math.PI / Math.max(0.08, response)) ** 2 * 0.15);
  const damping = 2 * Math.sqrt(stiffness * mass) * dampingFraction;
  return { stiffness, damping, mass };
}

/** Map 0..1 progress to a spring-driven 0..1 curve (may overshoot if underdamped). */
export function springCurve(progress: number, config?: SpringSpec): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const { stiffness, damping, mass } = resolveSpring(config);

  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const epsilon = 0.001;
  // Guard overdamped / critical zero-ish zeta
  const decay = Math.max(1e-6, zeta * omega);
  const settleTime = -Math.log(epsilon) / decay;
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
 * const scale = std.spring(0.8, 1, p, "gentle");
 * const x = std.spring(0, 100, p, { stiffness: 200, damping: 20 });
 * ```
 */
export function spring(
  from: number,
  to: number,
  progress: number,
  config?: SpringSpec,
): number {
  return lerp(from, to, springCurve(progress, config));
}
