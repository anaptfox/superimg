/**
 * Carousel — one active item at a time; previous items exit their slot.
 * Use for thread slides, wizard steps, single-card transitions.
 *
 * Next item begins entering when the current item starts exiting (crossfade overlap).
 */

import { clamp01 } from "./easing.js";
import { interpolate } from "./interpolate.js";

export interface CarouselOpts {
  /** Parent progress 0–1 (typically `d.in("main")`). */
  during: number;
  lead?: number;
  trail?: number;
  /** Per-item enter fraction of slot (default 0.35). */
  enter?: number;
  /** Per-item exit fraction of slot (default 0.2). */
  exit?: number;
  /** Last item: `"hold"` stays visible after its slot (default); `"exit"` removes it. */
  last?: "hold" | "exit";
}

export interface CarouselItemState {
  index: number;
  /** 0→1 during enter, then 1 through hold and exit start. */
  enter: number;
  /** 0→1 during exit phase only. */
  exit: number;
  visible: boolean;
  active: boolean;
  state: "hidden" | "entering" | "hold" | "exiting" | "gone";
}

export interface Carousel<T> {
  readonly count: number;
  state(index: number): CarouselItemState;
  each(fn: (item: T, state: CarouselItemState, index: number) => void): void;
}

export function carousel<T>(items: readonly T[], opts: CarouselOpts): Carousel<T> {
  const count = items.length;
  const lead = opts.lead ?? 0.05;
  const trail = opts.trail ?? 0.05;
  const enterFrac = opts.enter ?? 0.35;
  const exitFrac = opts.exit ?? 0.2;
  const last = opts.last ?? "hold";
  const parent = clamp01(opts.during);

  const contentStart = lead;
  const contentEnd = 1 - trail;
  const contentSpan = Math.max(0.001, contentEnd - contentStart);
  const slot = count > 0 ? contentSpan / count : contentSpan;
  const step = count > 1 ? slot * (1 - exitFrac) : 0;

  function state(index: number): CarouselItemState {
    if (index < 0 || index >= count) {
      return { index, enter: 0, exit: 0, visible: false, active: false, state: "hidden" };
    }

    const itemStart = contentStart + index * step;
    const itemEnd = itemStart + slot;
    const enterEnd = itemStart + slot * enterFrac;
    const exitStart = itemEnd - slot * exitFrac;
    const isLast = index === count - 1;
    const globalP = parent;

    if (globalP < itemStart) {
      return { index, enter: 0, exit: 0, visible: false, active: false, state: "hidden" };
    }

    if (isLast && last === "hold" && globalP >= enterEnd) {
      return { index, enter: 1, exit: 0, visible: true, active: true, state: "hold" };
    }

    if (globalP >= itemEnd) {
      return { index, enter: 1, exit: 1, visible: false, active: false, state: "gone" };
    }
    if (globalP < enterEnd) {
      const enter = interpolate(globalP, [itemStart, enterEnd], [0, 1], "easeOutCubic");
      return {
        index,
        enter,
        exit: 0,
        visible: enter > 0,
        active: true,
        state: "entering",
      };
    }
    if (globalP >= exitStart) {
      const exit = interpolate(globalP, [exitStart, itemEnd], [0, 1], "easeInCubic");
      return {
        index,
        enter: 1,
        exit,
        visible: exit < 1,
        active: true,
        state: "exiting",
      };
    }
    return { index, enter: 1, exit: 0, visible: true, active: true, state: "hold" };
  }

  return {
    count,
    state,
    each(fn) {
      items.forEach((item, i) => fn(item, state(i), i));
    },
  };
}