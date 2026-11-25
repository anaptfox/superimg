//! Utility functions for SuperImg core

/**
 * Parse duration from string or number to seconds.
 *
 * @param d - Duration as number (seconds), string ('5s', '500ms', '30f'), or undefined
 * @param fieldName - Used in error messages for invalid format
 * @param fps - Required when d is in frames ('30f'). Used to convert frames to seconds.
 * @returns Duration in seconds. Returns 5 when undefined (default).
 */
export function parseDuration(
  d: string | number | undefined,
  fieldName = "duration",
  fps?: number
): number {
  if (typeof d === "number") return d;
  if (d === undefined) return 5;

  // Frames: "30f", "60f"
  const frameMatch = d.match(/^(\d+)(?:\.\d+)?f$/);
  if (frameMatch) {
    if (fps === undefined) {
      throw new Error(
        `Invalid ${fieldName}: "${d}". Frame duration requires fps to be specified.`
      );
    }
    return parseFloat(frameMatch[1]!) / fps;
  }

  // Bare seconds: "0", "1.5" (export --at; inspect --at is a different clock)
  const bare = d.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return parseFloat(bare[1]!);

  // Seconds or milliseconds: "5s", "500ms", "2.5s"
  const match = d.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) {
    const atHint =
      fieldName === "--at" || fieldName === "at"
        ? ` Export --at is time in seconds (0, 0s, 1.5s). Inspect --at is progress 0–1 (or f:N).`
        : "";
    throw new Error(
      `Invalid ${fieldName}: "${d}". Expected format: "5s", "500ms", "30f", or a bare number of seconds.${atHint}`,
    );
  }

  const value = parseFloat(match[1]!);
  const unit = match[2]!;
  return unit === "ms" ? value / 1000 : value;
}
