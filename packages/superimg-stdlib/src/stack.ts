/**
 * Stack — ordered reveal; items stay visible once shown (chat, FAQ, lists).
 * Optional weights give longer content more of the parent phase window.
 */

import { clamp01 } from "./easing.js";
import { interpolate } from "./interpolate.js";

export interface StackOpts {
  /** Parent progress 0–1 (typically `d.in("main")`). */
  during: number;
  lead?: number;
  trail?: number;
  /** Per-item enter fraction of slot (default 0.35). */
  enter?: number;
  /**
   * Relative slot widths (same length as items). Omitted → equal slots.
   * Values must be finite and > 0.
   */
  weights?: readonly number[];
}

export interface StackItemState {
  index: number;
  state: "hidden" | "entering" | "revealed";
  /** 0→1 during enter phase, then 1. */
  enter: number;
  /** 0→1 across this item's slot window (for q→a, typing sub-beats). */
  slot: number;
  visible: boolean;
  active: boolean;
}

export interface Stack<T> {
  readonly count: number;
  state(index: number): StackItemState;
  each(fn: (item: T, state: StackItemState, index: number) => void): void;
}

function resolveWeights(count: number, weights?: readonly number[]): number[] {
  if (count === 0) return [];
  if (!weights) return Array.from({ length: count }, () => 1);
  if (weights.length !== count) {
    throw new Error(
      `stack(): weights length (${weights.length}) must match items length (${count})`,
    );
  }
  return weights.map((w, i) => {
    if (!Number.isFinite(w) || w <= 0) {
      throw new Error(`stack(): weights[${i}] must be a finite number > 0 (got ${w})`);
    }
    return w;
  });
}

/** Cumulative [start, end) windows in content-normalized [0, 1] for each item. */
export function stackSlotWindows(
  count: number,
  weights?: readonly number[],
): { start: number; end: number; fraction: number }[] {
  const w = resolveWeights(count, weights);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return w.map((wi) => {
    const fraction = wi / total;
    const start = acc;
    const end = acc + fraction;
    acc = end;
    return { start, end, fraction };
  });
}

export function stack<T>(items: readonly T[], opts: StackOpts): Stack<T> {
  const count = items.length;
  const lead = opts.lead ?? 0.05;
  const trail = opts.trail ?? 0.05;
  const enterFrac = opts.enter ?? 0.35;
  const parent = clamp01(opts.during);

  const contentStart = lead;
  const contentEnd = 1 - trail;
  const contentSpan = Math.max(0.001, contentEnd - contentStart);
  const windows = stackSlotWindows(count, opts.weights);

  function state(index: number): StackItemState {
    if (index < 0 || index >= count) {
      return { index, enter: 0, slot: 0, visible: false, active: false, state: "hidden" };
    }

    const win = windows[index]!;
    const itemStart = contentStart + win.start * contentSpan;
    const itemEnd = contentStart + win.end * contentSpan;
    const slotLen = Math.max(0.0001, itemEnd - itemStart);
    const enterEnd = itemStart + slotLen * enterFrac;
    const globalP = parent;

    const slotP = clamp01(interpolate(globalP, [itemStart, itemEnd], [0, 1]));

    if (globalP < itemStart) {
      return { index, enter: 0, slot: 0, visible: false, active: false, state: "hidden" };
    }
    if (globalP < enterEnd) {
      const enterP = interpolate(globalP, [itemStart, enterEnd], [0, 1], "easeOutCubic");
      return {
        index,
        enter: enterP,
        slot: slotP,
        visible: enterP > 0,
        active: true,
        state: "entering",
      };
    }
    return {
      index,
      enter: 1,
      slot: slotP,
      visible: true,
      active: true,
      state: "revealed",
    };
  }

  return {
    count,
    state,
    each(fn) {
      items.forEach((item, i) => fn(item, state(i), i));
    },
  };
}
