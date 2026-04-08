/**
 * Phase utilities for SuperImg templates
 *
 * Split a 0-1 progress value into named sub-phases with automatic normalization.
 * Replaces manual clamp calculations with declarative phase definitions.
 *
 * @example
 * ```ts
 * // Before (3 lines of magic numbers):
 * const enterProgress = std.math.clamp(progress * 3, 0, 1);
 * const holdProgress = std.math.clamp((progress - 0.33) * 1.5, 0, 1);
 * const exitProgress = std.math.clamp((progress - 0.66) * 3, 0, 1);
 *
 * // After (1 line):
 * const { enter, hold, exit } = std.phases(progress, { enter: 1, hold: 1, exit: 1 });
 * ```
 */

import { clamp01 } from "./easing";

/** Result for a single phase */
export interface Phase {
  /** Progress within this phase (0-1, clamped) */
  progress: number;
  /** True when currently in this phase (0 < progress < 1) */
  active: boolean;
  /** True when this phase has completed (progress >= 1) */
  done: boolean;
  /** Normalized start position (0-1) within overall progress */
  start: number;
  /** Normalized end position (0-1) within overall progress */
  end: number;
}

/**
 * Split progress into named phases by weight.
 *
 * Weights are normalized to sum to 1. Each phase gets a proportional slice
 * of the overall progress. The returned object maps phase names to Phase objects.
 *
 * @param progress - Overall progress value (0-1)
 * @param config - Object mapping phase names to weights (relative durations)
 * @returns Object mapping phase names to Phase results
 *
 * @example
 * ```ts
 * // Equal phases (each gets 33.3%)
 * const { enter, hold, exit } = std.phases(progress, { enter: 1, hold: 1, exit: 1 });
 *
 * // Custom weights (30% enter, 50% hold, 20% exit)
 * const { intro, main, outro } = std.phases(progress, { intro: 3, main: 5, outro: 2 });
 *
 * // Use phase progress for animation
 * const opacity = enter.active ? std.tween(0, 1, enter.progress, "easeOut") : 1;
 * ```
 */
export function phases<K extends string>(
  progress: number,
  config: Record<K, number>
): Record<K, Phase> {
  const keys = Object.keys(config) as K[];
  const weights = keys.map((k) => config[k]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    throw new Error("phases: total weight must be > 0");
  }

  const result = {} as Record<K, Phase>;
  let cursor = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const weight = weights[i];
    const normalizedWeight = weight / totalWeight;

    const start = cursor;
    const end = cursor + normalizedWeight;

    // Calculate progress within this phase
    let phaseProgress: number;
    if (progress <= start) {
      phaseProgress = 0;
    } else if (progress >= end) {
      phaseProgress = 1;
    } else {
      phaseProgress = (progress - start) / normalizedWeight;
    }

    result[key] = {
      progress: clamp01(phaseProgress),
      active: progress > start && progress < end,
      done: progress >= end,
      start,
      end,
    };

    cursor = end;
  }

  return result;
}
