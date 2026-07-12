//! Parse --at sample list for superimg inspect.

export type AtSample =
  | { kind: "progress"; progress: number; label: string }
  | { kind: "frame"; frame: number; label: string };

const DEFAULT_AT = ["0", "0.25", "0.5", "0.75", "1"];

/**
 * Parse a comma-separated --at list.
 * Accepts progress 0–1 (e.g. 0.5) or frames f:N (e.g. f:120).
 */
export function parseAtList(raw: string | undefined): AtSample[] {
  const parts = (raw?.trim() ? raw.split(",") : DEFAULT_AT)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("--at list is empty");
  }

  return parts.map((part) => {
    if (/^f:\d+$/i.test(part)) {
      const frame = parseInt(part.slice(2), 10);
      if (!Number.isFinite(frame) || frame < 0) {
        throw new Error(`Invalid --at frame sample: "${part}" (expected f:N with N ≥ 0)`);
      }
      return { kind: "frame" as const, frame, label: `f:${frame}` };
    }

    const progress = Number(part);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      throw new Error(
        `Invalid --at progress sample: "${part}" (expected 0–1 or f:N, e.g. 0.5 or f:120)`,
      );
    }
    return { kind: "progress" as const, progress, label: String(progress) };
  });
}

/** Parse --diff a,b into two progresses 0–1. */
export function parseDiffPair(raw: string): { from: number; to: number } {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`--diff expects two progresses, e.g. --diff 0.35,0.85 (got "${raw}")`);
  }
  const from = Number(parts[0]);
  const to = Number(parts[1]);
  if (![from, to].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
    throw new Error(`--diff values must be 0–1 (got "${raw}")`);
  }
  return { from, to };
}
