//! "Did you mean?" fuzzy matching for typo'd identifiers.
//! Pure: no IO, browser-safe.

/**
 * Levenshtein distance between two strings (iterative DP, O(n·m)).
 * Used for "did you mean?" suggestions; we cap the relevant distance at 2.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl]!;
}

export interface DidYouMeanOptions {
  /** Maximum edit distance to consider a candidate (default 2) */
  maxDistance?: number;
  /** If true (default), match is case-insensitive */
  ignoreCase?: boolean;
}

/**
 * Find the closest candidate to `input` within `maxDistance` edits.
 * Returns null when no candidate is close enough.
 */
export function didYouMean(
  input: string,
  candidates: readonly string[],
  options: DidYouMeanOptions = {},
): string | null {
  const max = options.maxDistance ?? 2;
  const ignoreCase = options.ignoreCase ?? true;
  const needle = ignoreCase ? input.toLowerCase() : input;

  let bestDist = Infinity;
  let best: string | null = null;
  for (const candidate of candidates) {
    const cand = ignoreCase ? candidate.toLowerCase() : candidate;
    const dist = levenshtein(needle, cand);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  if (best == null || bestDist > max) return null;
  return best;
}
