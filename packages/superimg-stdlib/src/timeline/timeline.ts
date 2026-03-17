import type {
  Timeline,
  TimelineEvent,
  StaggerOptions,
  StaggerResult,
  FollowOptions,
} from './types';

/**
 * Internal representation of an event definition.
 */
interface EventDefinition {
  id: string;
  start: number;
  duration: number;
}

/**
 * Timeline implementation for declarative timing.
 */
class TimelineImpl implements Timeline {
  private readonly time: number;
  private readonly totalDuration: number;
  private readonly events: Map<string, EventDefinition> = new Map();

  constructor(time: number, duration: number) {
    this.time = time;
    this.totalDuration = duration;
  }

  /**
   * Build a TimelineEvent from a definition, calculating progress based on current time.
   */
  private buildEvent(def: EventDefinition): TimelineEvent {
    const { id, start, duration } = def;
    const end = start + duration;

    let progress: number;
    if (duration === 0) {
      // Zero-duration event: complete if at or past start
      progress = this.time >= start ? 1 : 0;
    } else if (this.time <= start) {
      progress = 0;
    } else if (this.time >= end) {
      progress = 1;
    } else {
      progress = (this.time - start) / duration;
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

  at(id: string, start: number, duration: number): TimelineEvent {
    const def: EventDefinition = { id, start, duration };
    this.events.set(id, def);
    return this.buildEvent(def);
  }

  get(id: string): TimelineEvent {
    const def = this.events.get(id);
    if (!def) {
      throw new Error(
        `Timeline event "${id}" not found. Define it first with at() or stagger().`
      );
    }
    return this.buildEvent(def);
  }

  current(): TimelineEvent | null {
    const defs = Array.from(this.events.values());
    for (const def of defs) {
      const event = this.buildEvent(def);
      if (event.active) {
        return event;
      }
    }
    return null;
  }

  follow(afterId: string, options: FollowOptions): TimelineEvent {
    const afterDef = this.events.get(afterId);
    if (!afterDef) {
      throw new Error(
        `Timeline event "${afterId}" not found. Define it first with at().`
      );
    }

    const afterEnd = afterDef.start + afterDef.duration;
    const gap = options.gap ?? 0;
    const start = afterEnd + gap;

    return this.at(options.id, start, options.duration);
  }

  stagger(ids: string[], options: StaggerOptions): StaggerResult {
    const { duration, start: startOffset = 0 } = options;

    // Handle empty array
    if (ids.length === 0) {
      return {
        get: (idOrIndex: string | number): TimelineEvent => {
          throw new Error(
            `Stagger is empty. Cannot get ${typeof idOrIndex === 'number' ? `index ${idOrIndex}` : `"${idOrIndex}"`}.`
          );
        },
        all: () => [],
        map: <T>(_fn: (event: TimelineEvent, index: number) => T): T[] => [],
      };
    }

    // Calculate 'each' - either provided or derived from totalDuration
    let each: number;
    if (options.each !== undefined) {
      each = options.each;
    } else if (options.totalDuration !== undefined) {
      // Spread items so last item ends at startOffset + totalDuration
      // startOffset + (n-1)*each + duration = startOffset + totalDuration
      // each = (totalDuration - duration) / (n - 1)
      each =
        ids.length > 1
          ? (options.totalDuration - duration) / (ids.length - 1)
          : 0;
    } else {
      throw new Error("stagger() requires either 'each' or 'totalDuration'");
    }

    // Create events
    const events: TimelineEvent[] = ids.map((id, index) => {
      const eventStart = startOffset + index * each;
      return this.at(id, eventStart, duration);
    });

    return {
      get: (idOrIndex: string | number): TimelineEvent => {
        if (typeof idOrIndex === 'number') {
          if (idOrIndex < 0 || idOrIndex >= events.length) {
            throw new Error(
              `Stagger index ${idOrIndex} out of bounds (0-${events.length - 1})`
            );
          }
          return events[idOrIndex];
        }
        const event = events.find((e) => e.id === idOrIndex);
        if (!event) {
          throw new Error(`Stagger event "${idOrIndex}" not found`);
        }
        return event;
      },
      all: () => [...events],
      map: <T>(fn: (event: TimelineEvent, index: number) => T): T[] =>
        events.map(fn),
    };
  }

  scope(start: number, end: number): Timeline {
    // Re-zero time to scope's origin
    const scopedTime = this.time - start;
    const scopedDuration = end - start;

    return new TimelineImpl(scopedTime, scopedDuration);
  }
}

/**
 * Create a new Timeline for declarative timing.
 *
 * @param time - Current time in seconds (e.g., ctx.sceneTimeSeconds)
 * @param duration - Total timeline duration in seconds (e.g., ctx.sceneDurationSeconds)
 * @returns A Timeline instance for defining and querying timing events
 *
 * @example
 * ```ts
 * const tl = timeline(ctx.sceneTimeSeconds, ctx.sceneDurationSeconds);
 *
 * // Define events
 * const enter = tl.at("enter", 0, 1.2);
 * const exit = tl.at("exit", 3.0, 1.0);
 *
 * // Stagger multiple elements
 * const items = tl.stagger(["a", "b", "c"], { each: 0.2, duration: 0.5 });
 *
 * // Use progress for animations
 * const opacity = std.tween(0, 1, enter.progress, "easeOutCubic");
 * ```
 */
export function timeline(time: number, duration: number): Timeline {
  return new TimelineImpl(time, duration);
}
