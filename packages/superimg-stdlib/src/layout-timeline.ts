/**
 * layoutTimeline — pure seconds → percent PhaseConfig + total duration.
 *
 * Use the same pure call from resolve() and render() so job duration and
 * director phases always match.
 */

export interface LayoutTimelineResult {
  /** Percent phase strings for ctx.director() — sum to 100%. */
  phases: Record<string, string>;
  /** Absolute scene length in seconds. */
  totalSeconds: number;
  /** Segment names in insertion order. */
  order: string[];
}

/**
 * Map absolute-second segments to a director phase layout.
 *
 * @param segments - name → duration in seconds (must be > 0). Object key order is preserved.
 * @returns percent phases (sum 100%), totalSeconds, and stable order
 *
 * @example
 * ```ts
 * const { phases, totalSeconds } = layoutTimeline({ boot: 1, type: 2, event_0: 0.9 });
 * // resolve: return { duration: `${totalSeconds}s`, phases }
 * // render:  const d = ctx.director(phases)
 * ```
 */
export function layoutTimeline(
  segments: Record<string, number>,
): LayoutTimelineResult {
  const order = Object.keys(segments);
  if (order.length === 0) {
    throw new Error("layoutTimeline(): segments must have at least one phase");
  }

  const seconds = order.map((name) => {
    const s = segments[name]!;
    if (!Number.isFinite(s) || s <= 0) {
      throw new Error(
        `layoutTimeline(): segment "${name}" must be a finite number > 0 (got ${s})`,
      );
    }
    return s;
  });

  const totalSeconds = seconds.reduce((a, b) => a + b, 0);
  const phases: Record<string, string> = {};
  for (let i = 0; i < order.length; i++) {
    const name = order[i]!;
    const fraction = seconds[i]! / totalSeconds;
    // Enough precision that sums stay near 100% without noisy floats in inspect.
    phases[name] = `${fraction * 100}%`;
  }

  return { phases, totalSeconds, order };
}
