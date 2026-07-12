/**
 * Timing craft helpers — duration, readability, and ms↔fraction conversion.
 *
 * Encodes animator skill tables as pure functions of text/distance/time.
 */

/** Count whitespace-separated words (empty → 0). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Settled on-screen hold for readable text (animator skill).
 * `max(min, words / 3)` seconds — ~3 words/s, floor 0.8s.
 */
export function readTimeSeconds(
  textOrWords: string | number,
  opts?: { wpm?: number; min?: number },
): number {
  const words =
    typeof textOrWords === "number" ? textOrWords : wordCount(textOrWords);
  const wordsPerSec = (opts?.wpm ?? 180) / 60; // 3 words/s default
  const min = opts?.min ?? 0.8;
  if (words <= 0) return min;
  return Math.max(min, words / wordsPerSec);
}

/**
 * Build a full scene length: enter + settled hold + faster exit.
 */
export function sceneDuration(opts: {
  text?: string;
  words?: number;
  /** Enter seconds. Default 0.5 */
  enter?: number;
  /** Exit seconds. Default enter / 1.25 (~25% faster) */
  exit?: number;
  holdMin?: number;
  /** Extra pad after settle before exit. Default 0.5 */
  pad?: number;
}): number {
  const enter = opts.enter ?? 0.5;
  const exit = opts.exit ?? enter / 1.25;
  const hasText = opts.text != null || opts.words != null;
  const hold = Math.max(
    opts.holdMin ?? 0,
    hasText
      ? readTimeSeconds(opts.text ?? opts.words!, { min: 0.8 }) + (opts.pad ?? 0.5)
      : 1.5,
  );
  return enter + hold + exit;
}

/**
 * Sub-linear travel duration (Carbon-style): 2× distance ≈ 1.3× time.
 */
export function durationForDistance(
  baseMs: number,
  distancePx: number,
  refPx = 100,
): number {
  const ratio = Math.max(0.25, distancePx / Math.max(1, refPx));
  return baseMs * Math.pow(ratio, 0.4);
}

/** Convert milliseconds to a 0–1 fraction of a parent window in seconds. */
export function msToFraction(ms: number, windowSeconds: number): number {
  if (windowSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, ms / 1000 / windowSeconds));
}

/** Quantize seconds to a beat grid (default 120bpm). */
export function snapToBeat(
  seconds: number,
  bpm = 120,
  subdivision = 1,
): number {
  const beat = 60 / bpm / Math.max(1, subdivision);
  if (beat <= 0) return seconds;
  return Math.round(seconds / beat) * beat;
}

/** Namespace object for `std.timing`. */
export const timing = {
  wordCount,
  readTimeSeconds,
  /** Alias matching skill wording. */
  readTime: readTimeSeconds,
  sceneDuration,
  durationForDistance,
  msToFraction,
  snapToBeat,
} as const;
