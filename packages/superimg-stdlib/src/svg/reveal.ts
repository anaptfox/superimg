/**
 * Clip-path reveal helpers.
 * All return CSS clip-path strings that work on any HTML element.
 */

const { cos, sin, PI, round, max, min, sqrt } = Math;

function r3(n: number): number {
  return round(n * 1000) / 1000;
}

export interface CircleRevealOptions {
  /** Center X as fraction (0-1). Default: 0.5 */
  cx?: number;
  /** Center Y as fraction (0-1). Default: 0.5 */
  cy?: number;
}

export type WipeDirection = "left" | "right" | "up" | "down";

export interface InsetRevealOptions {
  /** Per-side multipliers [top, right, bottom, left]. Default: uniform */
  asymmetry?: [number, number, number, number];
}

function clamp01(t: number): number {
  return max(0, min(1, t));
}

/** Circular reveal — expanding circle from center */
function circleReveal(progress: number, opts?: CircleRevealOptions): string {
  const t = clamp01(progress);
  const cx = (opts?.cx ?? 0.5) * 100;
  const cy = (opts?.cy ?? 0.5) * 100;
  // Max radius to cover full rectangle from center point
  const maxR = sqrt(
    max(cx, 100 - cx) ** 2 + max(cy, 100 - cy) ** 2,
  );
  const radius = r3(t * maxR);
  return `circle(${radius}% at ${r3(cx)}% ${r3(cy)}%)`;
}

/** Directional wipe reveal */
function wipeReveal(progress: number, direction: WipeDirection = "right"): string {
  const t = clamp01(progress);
  const p = r3(t * 100);
  switch (direction) {
    case "right":
      return `inset(0 ${r3(100 - p)}% 0 0)`;
    case "left":
      return `inset(0 0 0 ${r3(100 - p)}%)`;
    case "down":
      return `inset(0 0 ${r3(100 - p)}% 0)`;
    case "up":
      return `inset(${r3(100 - p)}% 0 0 0)`;
  }
}

/** Inset (shrinking rectangle) reveal — from edges inward */
function insetReveal(progress: number, opts?: InsetRevealOptions): string {
  const t = clamp01(progress);
  const asym = opts?.asymmetry ?? [1, 1, 1, 1];
  const inset = (1 - t) * 50;
  return `inset(${r3(inset * asym[0])}% ${r3(inset * asym[1])}% ${r3(inset * asym[2])}% ${r3(inset * asym[3])}%)`;
}

/** Iris (polygon) reveal — expanding polygon from center */
function irisReveal(progress: number, sides: number = 6): string {
  const t = clamp01(progress);
  // Scale from 0% to 150% radius to ensure full coverage
  const radius = t * 150;
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * PI * 2 - PI / 2;
    const x = 50 + cos(angle) * radius;
    const y = 50 + sin(angle) * radius;
    points.push(`${r3(x)}% ${r3(y)}%`);
  }
  return `polygon(${points.join(", ")})`;
}

export const reveal = {
  circle: circleReveal,
  wipe: wipeReveal,
  inset: insetReveal,
  iris: irisReveal,
};
