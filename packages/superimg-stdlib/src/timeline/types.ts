/**
 * Represents a single timing event on the timeline.
 * All times are in seconds.
 */
export interface TimelineEvent {
  /** Unique identifier for this event */
  id: string;
  /** 0 = not started, 0-1 = in progress, 1 = complete */
  progress: number;
  /** true when 0 < progress < 1 */
  active: boolean;
  /** Start time relative to timeline origin (seconds) */
  start: number;
  /** End time relative to timeline origin (seconds) */
  end: number;
  /** Duration in seconds (end - start) */
  duration: number;
}

/**
 * Options for staggered animations.
 */
export interface StaggerOptions {
  /** Delay between each item's start (seconds). Mutually exclusive with totalDuration. */
  each?: number;
  /** Duration of each item's animation (seconds) */
  duration: number;
  /** Total time to spread all items across. Auto-calculates 'each'. Mutually exclusive with each. */
  totalDuration?: number;
  /** Start offset from timeline origin (seconds). Default: 0 */
  start?: number;
}

/**
 * Result of a stagger() call. Provides access to individual staggered events.
 */
export interface StaggerResult {
  /** Get event by ID or zero-based index */
  get(idOrIndex: string | number): TimelineEvent;
  /** Get all events in order */
  all(): TimelineEvent[];
  /** Map over events (useful for rendering) */
  map<T>(fn: (event: TimelineEvent, index: number) => T): T[];
}

/**
 * Options for follow() - creates an event relative to another event.
 */
export interface FollowOptions {
  /** ID for the new event */
  id: string;
  /** Gap after the referenced event ends (seconds). Default: 0 */
  gap?: number;
  /** Duration of the new event (seconds) */
  duration: number;
}

/**
 * Main Timeline interface for declarative timing.
 */
export interface Timeline {
  /** Create an event at absolute position */
  at(id: string, start: number, duration: number): TimelineEvent;

  /** Get a previously defined event by ID */
  get(id: string): TimelineEvent;

  /** Get the currently active event (0 < progress < 1), or null */
  current(): TimelineEvent | null;

  /** Create an event that starts after another event ends */
  follow(afterId: string, options: FollowOptions): TimelineEvent;

  /** Create staggered events for multiple items */
  stagger(ids: string[], options: StaggerOptions): StaggerResult;

  /** Create a scoped timeline re-zeroed to [start, end] */
  scope(start: number, end: number): Timeline;
}

// ============================================================================
// Markers API
// ============================================================================

/**
 * Result of markers() - query progress between named timestamps.
 */
export interface MarkerSync {
  /** Get 0-1 progress between two markers */
  progress(from: string, to: string): number;

  /** Get a TimelineEvent spanning from one marker to another */
  segment(from: string, to: string): TimelineEvent;

  /** Get current segment as TimelineEvent, or null if before first marker */
  current(): TimelineEvent | null;

  /** Get timestamp for a marker */
  at(marker: string): number;
}

// ============================================================================
// Script API
// ============================================================================

/**
 * A timed event in the script.
 */
export interface ScriptEvent {
  /** Unique identifier for this event */
  id: string;
  /** Start time in seconds */
  time: number;
  /** Duration in seconds. Default: 0.5s or until next event */
  duration?: number;
}

/**
 * Result of script() - query timed events.
 */
export interface ScriptSync {
  /** Get TimelineEvent for a script event (uses its duration) */
  get(id: string): TimelineEvent;

  /** Get the currently active event, or null */
  current(): TimelineEvent | null;

  /** Get all events as TimelineEvents */
  all(): TimelineEvent[];
}

// ============================================================================
// Transcript API
// ============================================================================

/**
 * A transcribed word with timing (normalized format).
 */
export interface TranscriptWord {
  /** The word text */
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/** TimelineEvent extended with word text */
export type WordEvent = TimelineEvent & { text: string };

/**
 * Result of transcript() - query words synchronized to time.
 */
export interface TranscriptSync {
  /** Get word by index (0-based) */
  at(index: number): WordEvent;

  /** Get current word at time, or null */
  current(): WordEvent | null;

  /** Get all words as WordEvents */
  all(): WordEvent[];

  /** Get words overlapping time range [start, end] */
  range(start: number, end: number): WordEvent[];

  /** Search for word (case-insensitive), returns first match */
  find(text: string): WordEvent | null;

  /** Map over all words */
  map<T>(fn: (event: WordEvent, index: number) => T): T[];

  /** Total word count */
  count(): number;

  /** Total duration of transcript */
  duration(): number;

  /**
   * Character progress within current word.
   * Returns 0 to text.length (not 0-1).
   * Useful for karaoke-style character-by-character highlighting.
   *
   * @example
   * ```ts
   * const charProg = t.charProgress(); // e.g., 3.5 for "Hello" at 70%
   * const fullChars = Math.floor(charProg);
   * const partialChar = charProg - fullChars;
   * ```
   */
  charProgress(): number;

  /**
   * Get WordEvent spanning from word at fromIndex to word at toIndex.
   * Useful for animating phrases or groups of words together.
   *
   * @example
   * ```ts
   * const phrase = t.between(0, 2); // "Hello beautiful world"
   * const opacity = std.tween(0, 1, phrase.progress, "easeOutCubic");
   * ```
   */
  between(fromIndex: number, toIndex: number): WordEvent;
}
