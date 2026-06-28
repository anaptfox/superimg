import type { MarkerSync, CueEvent } from './types';

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
 * // Get segment as CueEvent
 * const introToMain = m.segment("intro", "main");
 * const opacity = std.interpolate(introToMain.progress, [0, 1], [0, 1], "easeOutCubic");
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

    segment(from: string, to: string): CueEvent {
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

    current(): CueEvent | null {
      // Find which segment we're in
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next) continue;
        const [name, markerTime] = current;
        const [nextName, nextTime] = next;

        if (time >= markerTime && time < nextTime) {
          // Return as CueEvent (same as segment())
          return this.segment(name, nextName);
        }
      }

      // After last marker - return last segment with progress=1
      const lastEntry = sorted[sorted.length - 1];
      if (sorted.length > 1 && lastEntry && time >= lastEntry[1]) {
        const prevEntry = sorted[sorted.length - 2];
        if (!prevEntry) return null;
        const [prevName] = prevEntry;
        const [lastName] = lastEntry;
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
