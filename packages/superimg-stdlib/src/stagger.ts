/**
 * Stagger utilities for SuperImg animations
 *
 * Distributes progress across multiple items so each starts
 * slightly after the previous, creating cascading animations.
 *
 * @example
 * ```ts
 * // Count-based: get per-item progress values
 * const progresses = std.stagger(5, sceneProgress, { duration: 0.3 });
 * // [0.8, 0.6, 0.4, 0.2, 0] at sceneProgress=0.5
 *
 * // Items-based: get enriched objects
 * const items = std.stagger(["A", "B", "C"], sceneProgress, { duration: 0.4 });
 * items.map(({ item, progress }) => `<div style="opacity: ${progress}">${item}</div>`)
 * ```
 */

import { clamp01 } from "./easing";
import { tween, type EasingName, type EasingFn } from "./tween";

export interface StaggerOptions {
  /** Delay between item starts as fraction of total (0-1). Mutually exclusive with duration. */
  each?: number;
  /** Each item's animation window as fraction of total (0-1). Mutually exclusive with each. */
  duration?: number;
  /** Direction: which items start first. Default: "start" */
  from?: "start" | "end" | "center" | "edges";
  /** Per-item easing function or name. Default: linear */
  easing?: EasingName | EasingFn;
}

export interface StaggerItem<T> {
  item: T;
  /** Per-item progress (0-1, clamped) */
  progress: number;
  index: number;
  /** True when 0 < progress < 1 */
  active: boolean;
  /** True when progress >= 1 */
  done: boolean;
}

/**
 * Distribute progress across items for staggered animations.
 *
 * @example Count-based
 * ```ts
 * const progresses = std.stagger(3, sceneProgress, { duration: 0.4 });
 * ```
 *
 * @example Items-based
 * ```ts
 * const staggered = std.stagger(["A", "B", "C"], sceneProgress, { from: "center" });
 * ```
 */
export function stagger(count: number, progress: number, options?: StaggerOptions): number[];
export function stagger<T>(items: T[], progress: number, options?: StaggerOptions): StaggerItem<T>[];
export function stagger<T>(
  countOrItems: number | T[],
  progress: number,
  options?: StaggerOptions,
): number[] | StaggerItem<T>[] {
  const isArray = Array.isArray(countOrItems);
  const count = isArray ? countOrItems.length : (countOrItems as number);

  if (count <= 0) return [];
  if (count === 1) {
    const p = applyEasing(clamp01(progress), options?.easing);
    if (isArray) {
      return [{ item: countOrItems[0], progress: p, index: 0, active: p > 0 && p < 1, done: p >= 1 }];
    }
    return [p];
  }

  // Calculate each/duration
  let each: number;
  let dur: number;
  if (options?.each != null) {
    each = options.each;
    dur = Math.max(0.05, 1 - each * (count - 1));
  } else if (options?.duration != null) {
    dur = options.duration;
    each = (1 - dur) / (count - 1);
  } else {
    each = 1 / (count + 1);
    dur = 1 - each * (count - 1);
  }

  // Compute delay order based on `from` direction
  const delays = computeDelays(count, options?.from ?? "start");

  // Calculate per-item progress
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = delays[i] * each * (count - 1);
    const end = start + dur;
    let itemProgress: number;
    if (start === end) {
      itemProgress = progress >= start ? 1 : 0;
    } else {
      itemProgress = clamp01((progress - start) / (end - start));
    }
    results.push(applyEasing(itemProgress, options?.easing));
  }

  if (isArray) {
    return results.map((p, i) => ({
      item: (countOrItems as T[])[i],
      progress: p,
      index: i,
      active: p > 0 && p < 1,
      done: p >= 1,
    }));
  }

  return results;
}

function applyEasing(t: number, easing: EasingName | EasingFn | undefined): number {
  if (!easing || t === 0 || t === 1) return t;
  return tween(0, 1, t, easing);
}

/**
 * Compute normalized delay multipliers (0-1) for each index.
 * 0 = starts first, 1 = starts last.
 */
function computeDelays(count: number, from: "start" | "end" | "center" | "edges"): number[] {
  const last = count - 1;
  const delays: number[] = [];

  switch (from) {
    case "start":
      for (let i = 0; i < count; i++) delays.push(i / last);
      break;
    case "end":
      for (let i = 0; i < count; i++) delays.push((last - i) / last);
      break;
    case "center": {
      const mid = last / 2;
      const maxDist = mid;
      for (let i = 0; i < count; i++) {
        delays.push(maxDist === 0 ? 0 : Math.abs(i - mid) / maxDist);
      }
      break;
    }
    case "edges": {
      const mid = last / 2;
      const maxDist = mid;
      for (let i = 0; i < count; i++) {
        delays.push(maxDist === 0 ? 0 : 1 - Math.abs(i - mid) / maxDist);
      }
      break;
    }
  }

  return delays;
}
