//! Filename-safe slug helpers for batch render entry naming.

/** Lowercase ASCII slugifier — collapses runs of non-alphanumeric to `-`. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pick the per-entry suffix used in batch output filenames.
 *
 * Precedence:
 *   1. explicit `slug` field on the entry (slugified)
 *   2. slugified `name` / `title` / `id`
 *   3. zero-padded array index (width = number of digits in `total - 1`)
 */
export function deriveEntrySlug(
  entry: unknown,
  index: number,
  total: number,
): string {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const obj = entry as Record<string, unknown>;
    for (const key of ["slug", "name", "title", "id"] as const) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        const s = slugify(v);
        if (s) return s;
      }
    }
  }
  const width = Math.max(2, String(Math.max(0, total - 1)).length);
  return String(index).padStart(width, "0");
}
