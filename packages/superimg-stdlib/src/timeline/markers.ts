import type { MarkerSync, TimelineEvent } from './types';

/**
 * Create a marker sync for querying progress between named timestamps.
 *
 * @param def - Record of marker names to timestamps (in seconds)
 * @param time - Current time in seconds
 * @returns A MarkerSync instance for querying progress between markers
 *
 * @example
 * ```ts
 * const m = markers({
 *   intro: 0,
 *   main: 2.5,
 *   outro: 8,
 * }, time);
 *
 * // Progress between markers
 * const fadeIn = m.progress("intro", "main");  // 0-1
 *
 * // Get segment as TimelineEvent
 * const introToMain = m.segment("intro", "main");
 * const opacity = std.tween(0, 1, introToMain.progress, "easeOutCubic");
 *
 * // What's active now?
 * const curr = m.current();  // { marker: "main", progress: 0.3 }
 * ```
 */
export function markers(
  def: Record<string, number>,
  time: number
): MarkerSync {
  // Sort markers by time for current() lookup
  const sorted = Object.entries(def).sort(([, a], [, b]) => a - b);

  return {
    progress(from: string, to: string): number {
      const fromTime = def[from];
      const toTime = def[to];
      if (fromTime === undefined) {
        throw new Error(`Marker "${from}" not found`);
      }
      if (toTime === undefined) {
        throw new Error(`Marker "${to}" not found`);
      }

      const duration = toTime - fromTime;
      if (duration === 0) {
        return time >= fromTime ? 1 : 0;
      }

      return Math.max(0, Math.min(1, (time - fromTime) / duration));
    },

    segment(from: string, to: string): TimelineEvent {
      const fromTime = def[from];
      const toTime = def[to];
      if (fromTime === undefined) {
        throw new Error(`Marker "${from}" not found`);
      }
      if (toTime === undefined) {
        throw new Error(`Marker "${to}" not found`);
      }

      const duration = toTime - fromTime;
      const progress = this.progress(from, to);

      return {
        id: `${from}->${to}`,
        progress,
        active: progress > 0 && progress < 1,
        start: fromTime,
        end: toTime,
        duration,
      };
    },

    current(): TimelineEvent | null {
      // Find which segment we're in
      for (let i = 0; i < sorted.length - 1; i++) {
        const [name, markerTime] = sorted[i];
        const [nextName, nextTime] = sorted[i + 1];

        if (time >= markerTime && time < nextTime) {
          // Return as TimelineEvent (same as segment())
          return this.segment(name, nextName);
        }
      }

      // After last marker - return last segment with progress=1
      if (sorted.length > 1 && time >= sorted[sorted.length - 1][1]) {
        const [prevName] = sorted[sorted.length - 2];
        const [lastName] = sorted[sorted.length - 1];
        return this.segment(prevName, lastName);
      }

      return null;
    },

    at(marker: string): number {
      const t = def[marker];
      if (t === undefined) {
        throw new Error(`Marker "${marker}" not found`);
      }
      return t;
    },
  };
}
