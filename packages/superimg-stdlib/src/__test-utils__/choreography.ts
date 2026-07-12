/**
 * Shared helpers for timing/choreography primitive tests.
 * Test-only — not exported from the package.
 */

import { expect } from "vitest";

export type ChoreographyPhase = "hidden" | "entering" | "hold" | "exiting" | "gone" | "revealed";

/** Evenly spaced samples in [start, end] inclusive. */
export function linspace(start: number, end: number, steps: number): number[] {
  if (steps <= 1) return [start];
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    out.push(start + (i / (steps - 1)) * (end - start));
  }
  return out;
}

/** Mirror thread slide transition opacity from enter/exit fields. */
export function slideOpacity(
  phase: "hidden" | "entering" | "hold" | "exiting" | "gone",
  enter: number,
  exit: number,
): number {
  if (phase === "entering") return enter;
  if (phase === "exiting") return 1 - exit;
  if (phase === "hold") return 1;
  return 0;
}

export function assertMonotonic(
  values: number[],
  direction: "asc" | "desc",
  label = "values",
): void {
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    if (direction === "asc") {
      expect(curr, `${label}[${i}]`).toBeGreaterThanOrEqual(prev);
    } else {
      expect(curr, `${label}[${i}]`).toBeLessThanOrEqual(prev);
    }
  }
}

export function assertContinuous(values: number[], maxDelta: number, label = "values"): void {
  for (let i = 1; i < values.length; i++) {
    const delta = Math.abs(values[i]! - values[i - 1]!);
    expect(delta, `${label} jump at ${i}`).toBeLessThanOrEqual(maxDelta);
  }
}

export function assertIn01(value: number, label = "value"): void {
  expect(value, label).toBeGreaterThanOrEqual(0);
  expect(value, label).toBeLessThanOrEqual(1);
}

/** Carousel slot schedule (mirrors carousel.ts). */
export function carouselSchedule(
  count: number,
  opts: { lead?: number; trail?: number; enter?: number; exit?: number } = {},
) {
  const lead = opts.lead ?? 0.05;
  const trail = opts.trail ?? 0.05;
  const enterFrac = opts.enter ?? 0.35;
  const exitFrac = opts.exit ?? 0.2;
  const contentStart = lead;
  const contentEnd = 1 - trail;
  const contentSpan = Math.max(0.001, contentEnd - contentStart);
  const slot = count > 0 ? contentSpan / count : contentSpan;
  const step = count > 1 ? slot * (1 - exitFrac) : 0;

  return (index: number) => {
    const itemStart = contentStart + index * step;
    const itemEnd = itemStart + slot;
    const enterEnd = itemStart + slot * enterFrac;
    const exitStart = itemEnd - slot * exitFrac;
    return { itemStart, enterEnd, exitStart, itemEnd, slot, step, contentStart, contentEnd };
  };
}

/** Stack slot schedule (mirrors stack.ts, equal weights). */
export function stackSchedule(
  count: number,
  opts: { lead?: number; trail?: number; enter?: number; weights?: readonly number[] } = {},
) {
  const lead = opts.lead ?? 0.05;
  const trail = opts.trail ?? 0.05;
  const enterFrac = opts.enter ?? 0.35;
  const contentStart = lead;
  const contentEnd = 1 - trail;
  const contentSpan = Math.max(0.001, contentEnd - contentStart);
  const weights = opts.weights ?? Array.from({ length: count }, () => 1);
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const windows = weights.map((w) => {
    const frac = w / totalW;
    const start = acc;
    const end = acc + frac;
    acc = end;
    return { start, end, frac };
  });

  return (index: number) => {
    const win = windows[index] ?? { start: 0, end: 0, frac: 0 };
    const itemStart = contentStart + win.start * contentSpan;
    const itemEnd = contentStart + win.end * contentSpan;
    const slot = Math.max(0.0001, itemEnd - itemStart);
    const enterEnd = itemStart + slot * enterFrac;
    return { itemStart, enterEnd, itemEnd, slot, contentStart, contentEnd };
  };
}