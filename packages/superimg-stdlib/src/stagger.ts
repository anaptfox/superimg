/**
 * Stagger utilities for SuperImg animations
 *
 * Distributes progress across multiple items so each starts
 * slightly after the previous, creating cascading animations.
 *
 * Omakase: default easing is easeOutCubic; use `stagger.ms` for
 * 30–80ms gaps with a hard 500ms total cascade cap.
 */

import { clamp01 } from "./easing";
import { tween } from "./tween";
import type { EasingName, EasingFn } from "./easing";
import { msToFraction } from "./timing.js";

export interface StaggerOptions {
  /** Delay between item starts as fraction of total (0-1). Mutually exclusive with duration. */
  each?: number;
  /** Each item's animation window as fraction of total (0-1). Mutually exclusive with each. */
  duration?: number;
  /** Direction: which items start first. Default: "start" */
  from?: "start" | "end" | "center" | "edges";
  /** Per-item easing. Default: easeOutCubic */
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
  /** Wall-clock start offset in ms (when using stagger.ms / plan) */
  startMs?: number;
  eachMs?: number;
  totalStaggerMs?: number;
}

export interface StaggerMsOptions {
  /** Gap between starts in ms. Default 50. */
  eachMs?: number;
  /** Hard cap on total cascade ms. Default 500. */
  capMs?: number;
  /** Parent window length in seconds (required for ms→fraction). */
  windowSeconds: number;
  from?: StaggerOptions["from"];
  easing?: StaggerOptions["easing"];
}

export interface StaggerPlan {
  each: number;
  duration: number;
  eachMs: number;
  totalMs: number;
}

/**
 * Compute fraction options that honor eachMs + capMs.
 * Shrinks each when (n-1)*eachMs would exceed capMs.
 */
export function staggerPlan(
  count: number,
  opts: Pick<StaggerMsOptions, "eachMs" | "capMs" | "windowSeconds">,
): StaggerPlan {
  const eachMs0 = opts.eachMs ?? 50;
  const capMs = opts.capMs ?? 500;
  const n = Math.max(1, count);
  const totalGap = Math.min(capMs, eachMs0 * Math.max(0, n - 1));
  const eachMs = n <= 1 ? 0 : totalGap / (n - 1);
  const each = msToFraction(eachMs, opts.windowSeconds);
  const totalGapSec = totalGap / 1000;
  const durSec = Math.max(0.05, opts.windowSeconds - totalGapSec);
  const duration = Math.min(1, durSec / Math.max(1e-9, opts.windowSeconds));
  // When window is very short, each may push past 1 — clamp via duration path
  if (each * (n - 1) >= 0.95) {
    const cappedEach = n <= 1 ? 0 : 0.5 / (n - 1);
    return {
      each: cappedEach,
      duration: Math.max(0.05, 1 - cappedEach * (n - 1)),
      eachMs,
      totalMs: totalGap,
    };
  }
  return {
    each,
    duration: Math.max(0.05, duration),
    eachMs,
    totalMs: totalGap,
  };
}

/**
 * Distribute progress across items for staggered animations.
 *
 * @example Count-based
 * ```ts
 * const progresses = std.stagger(3, timeline.progress, { duration: 0.4 });
 * ```
 *
 * @example Items-based
 * ```ts
 * const staggered = std.stagger(["A", "B", "C"], timeline.progress, { from: "center" });
 * ```
 */
function staggerImpl<T>(
  countOrItems: number | T[],
  progress: number,
  options?: StaggerOptions,
  meta?: { eachMs: number; totalMs: number },
): number[] | StaggerItem<T>[] {
  const isArray = Array.isArray(countOrItems);
  const count = isArray ? countOrItems.length : (countOrItems as number);
  const easing = options?.easing ?? "easeOutCubic";

  if (count <= 0) return [];
  if (count === 1) {
    const p = applyEasing(clamp01(progress), easing);
    if (isArray) {
      return [{
        item: countOrItems[0]!,
        progress: p,
        index: 0,
        active: p > 0 && p < 1,
        done: p >= 1,
        startMs: 0,
        eachMs: meta?.eachMs,
        totalStaggerMs: meta?.totalMs,
      }];
    }
    return [p];
  }

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

  const delays = computeDelays(count, options?.from ?? "start");

  const results: number[] = [];
  const starts: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = (delays[i] ?? 0) * each * (count - 1);
    starts.push(start);
    const end = start + dur;
    let itemProgress: number;
    if (start === end) {
      itemProgress = progress >= start ? 1 : 0;
    } else {
      itemProgress = clamp01((progress - start) / (end - start));
    }
    results.push(applyEasing(itemProgress, easing));
  }

  if (isArray) {
    return results.map((p, i) => ({
      item: (countOrItems as T[])[i]!,
      progress: p,
      index: i,
      active: p > 0 && p < 1,
      done: p >= 1,
      startMs: meta
        ? (starts[i] ?? 0) * (meta.totalMs / Math.max(1e-9, each * (count - 1) || 1)) * (meta.eachMs > 0 ? 1 : 0)
        : undefined,
      eachMs: meta?.eachMs,
      totalStaggerMs: meta?.totalMs,
    }));
  }

  return results;
}

/** Enrich items with correct startMs from plan. */
function staggerMsImpl<T>(
  items: T[],
  progress: number,
  opts: StaggerMsOptions,
): StaggerItem<T>[] {
  const plan = staggerPlan(items.length, opts);
  const staggered = staggerImpl(
    items,
    progress,
    {
      each: plan.each,
      from: opts.from,
      easing: opts.easing ?? "easeOutCubic",
    },
    { eachMs: plan.eachMs, totalMs: plan.totalMs },
  ) as StaggerItem<T>[];

  const delays = computeDelays(items.length, opts.from ?? "start");
  for (let i = 0; i < staggered.length; i++) {
    const entry = staggered[i]!;
    entry.startMs = (delays[i] ?? 0) * plan.totalMs;
    entry.eachMs = plan.eachMs;
    entry.totalStaggerMs = plan.totalMs;
  }
  return staggered;
}

export interface StaggerFn {
  (count: number, progress: number, options?: StaggerOptions): number[];
  <T>(items: T[], progress: number, options?: StaggerOptions): StaggerItem<T>[];
  lead: typeof staggerLead;
  plan: typeof staggerPlan;
  ms: {
    <T>(items: T[], progress: number, opts: StaggerMsOptions): StaggerItem<T>[];
    (count: number, progress: number, opts: StaggerMsOptions): number[];
  };
}

function staggerBase<T>(
  countOrItems: number | T[],
  progress: number,
  options?: StaggerOptions,
): number[] | StaggerItem<T>[] {
  return staggerImpl(countOrItems, progress, options);
}

export const stagger = staggerBase as StaggerFn;

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

export interface StaggerLeadOptions extends StaggerOptions {
  /** Minimum per-item progress to count as lead (default 0.35) */
  threshold?: number;
}

/**
 * Index of the item currently leading a stagger (highest progress above threshold).
 * Useful for syncing external UI (e.g. phone mockup) with staggered cards.
 */
export function staggerLead<T>(
  items: T[],
  progress: number,
  options?: StaggerLeadOptions,
): number {
  if (items.length === 0) return 0;
  const threshold = options?.threshold ?? 0.35;
  const staggered = stagger(items, progress, options);
  let best = 0;
  let bestP = -1;
  for (const entry of staggered) {
    if (entry.progress >= threshold && entry.progress > bestP) {
      bestP = entry.progress;
      best = entry.index;
    }
  }
  return bestP < 0 ? 0 : best;
}

function staggerMsOverload(
  countOrItems: number | unknown[],
  progress: number,
  opts: StaggerMsOptions,
): number[] | StaggerItem<unknown>[] {
  if (Array.isArray(countOrItems)) {
    return staggerMsImpl(countOrItems, progress, opts);
  }
  const plan = staggerPlan(countOrItems, opts);
  return staggerImpl(countOrItems, progress, {
    each: plan.each,
    from: opts.from,
    easing: opts.easing ?? "easeOutCubic",
  }) as number[];
}

stagger.lead = staggerLead;
stagger.plan = staggerPlan;
stagger.ms = staggerMsOverload as StaggerFn["ms"];
