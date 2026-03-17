import type { ScriptEvent, ScriptSync, TimelineEvent } from './types';

/** Default duration when not specified and no next event */
const DEFAULT_DURATION = 0.5;

/**
 * Create a script sync for querying timed events.
 *
 * @param events - Array of script events with id, time, and optional duration
 * @param time - Current time in seconds
 * @returns A ScriptSync instance for querying event progress
 *
 * @example
 * ```ts
 * const s = script([
 *   { id: "hero-text", time: 0.5 },
 *   { id: "product-shot", time: 2.3, duration: 1.0 },
 *   { id: "cta", time: 5.0 },
 * ], time);
 *
 * // Get event progress
 * const heroIn = s.trigger("hero-text");
 * const opacity = std.tween(0, 1, heroIn.progress, "easeOutCubic");
 *
 * // What's playing now?
 * const active = s.current();  // { id: "product-shot", progress: 0.4, ... }
 * ```
 */
export function script(events: ScriptEvent[], time: number): ScriptSync {
  // Sort by time
  const sorted = [...events].sort((a, b) => a.time - b.time);

  // Build event map with computed durations
  const eventMap = new Map<string, { start: number; duration: number }>();

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const nextEvent = sorted[i + 1];

    // Duration: explicit, or until next event (capped), or default
    let duration = event.duration;
    if (duration === undefined) {
      if (nextEvent) {
        duration = Math.min(nextEvent.time - event.time, DEFAULT_DURATION);
      } else {
        duration = DEFAULT_DURATION;
      }
    }

    eventMap.set(event.id, { start: event.time, duration });
  }

  function buildEvent(id: string): TimelineEvent {
    const def = eventMap.get(id);
    if (!def) {
      throw new Error(`Script event "${id}" not found`);
    }

    const { start, duration } = def;
    const end = start + duration;

    let progress: number;
    if (duration === 0) {
      progress = time >= start ? 1 : 0;
    } else if (time <= start) {
      progress = 0;
    } else if (time >= end) {
      progress = 1;
    } else {
      progress = (time - start) / duration;
    }

    return {
      id,
      progress,
      active: progress > 0 && progress < 1,
      start,
      end,
      duration,
    };
  }

  return {
    get(id: string): TimelineEvent {
      return buildEvent(id);
    },

    current(): TimelineEvent | null {
      const ids = Array.from(eventMap.keys());
      for (const id of ids) {
        const event = buildEvent(id);
        if (event.active) {
          return event;
        }
      }
      return null;
    },

    all(): TimelineEvent[] {
      return sorted.map((e) => buildEvent(e.id));
    },
  };
}
