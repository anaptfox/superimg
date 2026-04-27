/**
 * Represents a single timing event (a "cue").
 * All times are in seconds.
 */
export interface CueEvent {
  /** Unique identifier for this event */
  id: string;
  /** 0 = not started, 0-1 = in progress, 1 = complete */
  progress: number;
  /** true when 0 < progress < 1 */
  active: boolean;
  /** Start time relative to origin (seconds) */
  start: number;
  /** End time relative to origin (seconds) */
  end: number;
  /** Duration in seconds (end - start) */
  duration: number;
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

  /** Get a CueEvent spanning from one marker to another */
  segment(from: string, to: string): CueEvent;

  /** Get current segment as CueEvent, or null if before first marker */
  current(): CueEvent | null;

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
  /** Get CueEvent for a script event (uses its duration) */
  get(id: string): CueEvent;

  /** Get the currently active event, or null */
  current(): CueEvent | null;

  /** Get all events as CueEvents */
  all(): CueEvent[];
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

/** CueEvent extended with word text */
export type WordEvent = CueEvent & { text: string };

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
   */
  charProgress(): number;

  /**
   * Get WordEvent spanning from word at fromIndex to word at toIndex.
   * Useful for animating phrases or groups of words together.
   */
  between(fromIndex: number, toIndex: number): WordEvent;
}
