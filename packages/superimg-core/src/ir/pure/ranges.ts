//! Half-open frame range helpers.

import type { MediaIRFrameRange } from "@superimg/types";
import { MediaIRError } from "./errors.js";

export function assertFrameRange(range: MediaIRFrameRange, path = "range"): void {
  const { startFrame, endFrame } = range;
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame)) {
    throw new MediaIRError("invalid_range", `${path} frames must be integers`, { range });
  }
  if (startFrame < 0 || endFrame < 0) {
    throw new MediaIRError("invalid_range", `${path} frames must be non-negative`, { range });
  }
  if (endFrame < startFrame) {
    throw new MediaIRError(
      "invalid_range",
      `${path} must be half-open with endFrame >= startFrame`,
      { range },
    );
  }
  if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame)) {
    throw new MediaIRError("non_finite", `${path} has non-finite frames`, { range });
  }
}

export function rangesOverlap(a: MediaIRFrameRange, b: MediaIRFrameRange): boolean {
  return a.startFrame < b.endFrame && b.startFrame < a.endFrame;
}

export function rangesAdjacentOrOverlap(a: MediaIRFrameRange, b: MediaIRFrameRange): boolean {
  return a.startFrame <= b.endFrame && b.startFrame <= a.endFrame;
}

/** Merge adjacent/overlapping ranges; preserves order by startFrame. */
export function mergeRanges(ranges: readonly MediaIRFrameRange[]): MediaIRFrameRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((x, y) => x.startFrame - y.startFrame || x.endFrame - y.endFrame);
  const out: MediaIRFrameRange[] = [];
  let cur = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (n.startFrame <= cur.endFrame) {
      cur.endFrame = Math.max(cur.endFrame, n.endFrame);
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}

export function frameInRange(frame: number, range: MediaIRFrameRange): boolean {
  return frame >= range.startFrame && frame < range.endFrame;
}

export function qualifyId(sceneId: string, localId: string): string {
  return `${sceneId}::${localId}`;
}

export function parseQualifiedId(id: string): { sceneId: string; localId: string } {
  const idx = id.indexOf("::");
  if (idx <= 0) return { sceneId: "default", localId: id };
  return { sceneId: id.slice(0, idx), localId: id.slice(idx + 2) };
}
