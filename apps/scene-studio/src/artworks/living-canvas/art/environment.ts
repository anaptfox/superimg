/**
 * Environment art for "The Weight of a Choice": parallax rain, wet pavement
 * with ripple rings, the streetlight, and the light/shadow split.
 *
 * All motion values are computed by the caller from `timeline.seconds` so the
 * template stays a pure function of time (identical offline and live).
 */

const RAIN_FAR_WRAP = 160;
const RAIN_NEAR_WRAP = 220;
const RIPPLE_PERIOD = 2.6;

export interface EnvironmentMotion {
  /** Far rain layer background offset in px (already wrapped). */
  rainFar: number;
  /** Near rain layer background offset in px (already wrapped). */
  rainNear: number;
  /** Streetlight glow opacity (breathing). */
  glow: number;
  /** Ripple ring progress values, 0..1 each. */
  ripples: readonly number[];
}

/** Pure ambient motion from timeline seconds (scaffold-friendly for std.oscillate). */
export function environmentMotion(seconds: number): EnvironmentMotion {
  // Keep self-contained (no ctx) so art helpers stay pure and testable.
  const phase = (offset: number) => (seconds / RIPPLE_PERIOD + offset) % 1;
  const glowWave = Math.sin(seconds * 0.72);
  return {
    rainFar: (seconds * 140) % RAIN_FAR_WRAP,
    rainNear: (seconds * 260) % RAIN_NEAR_WRAP,
    glow: 0.82 + glowWave * 0.08,
    ripples: [phase(0), phase(0.5), phase(0.25), phase(0.75)],
  };
}

function rippleRing(progress: number): string {
  const scale = (0.25 + 0.75 * progress).toFixed(3);
  const opacity = ((1 - progress) * 0.35).toFixed(3);
  return `<i class="art-ripple" style="transform: translate(-50%, -50%) scale(${scale}); opacity: ${opacity}"></i>`;
}

export function rainArt(motion: EnvironmentMotion): string {
  return `<div class="art-rain">
    <div class="art-rain-far" style="background-position: 0 ${motion.rainFar.toFixed(2)}px"></div>
    <div class="art-rain-near" style="background-position: 0 ${motion.rainNear.toFixed(2)}px"></div>
  </div>`;
}

export function pavementArt(motion: EnvironmentMotion): string {
  const [a1, a2, b1, b2] = motion.ripples;
  return `<div class="art-pavement">
    <div class="art-puddle art-puddle-a">${rippleRing(a1 ?? 0)}${rippleRing(a2 ?? 0)}</div>
    <div class="art-puddle art-puddle-b">${rippleRing(b1 ?? 0)}${rippleRing(b2 ?? 0)}</div>
  </div>`;
}

export function streetlightArt(motion: EnvironmentMotion): string {
  return `<div class="art-streetlight">
    <svg class="lc" viewBox="0 0 240 700" aria-hidden="true">
      <path class="lc-lamp-pole" d="M196 82 V664 M180 664 H212"/>
      <path class="lc-lamp-arm" d="M196 88 Q196 30 132 30"/>
      <path class="lc-lamp-head" d="M106 30 H158 L151 58 H113 Z"/>
      <ellipse class="lc-lamp-glass" cx="132" cy="60" rx="17" ry="7"/>
    </svg>
    <div class="art-streetlight-glow" style="opacity: ${motion.glow.toFixed(3)}"></div>
  </div>`;
}

/** Non-semantic environment furniture (not addressable scene nodes). */
export function environmentShellArt(motion: EnvironmentMotion, inner: string): string {
  const reflection = (motion.glow * 0.5).toFixed(3);
  return `<div class="art-environment">
    <div class="art-grain"></div>
    <div class="art-shadow-side"></div>
    ${inner}
    <div class="art-wallet-reflection" style="opacity: ${reflection}"></div>
    <div class="art-vignette"></div>
  </div>`;
}
