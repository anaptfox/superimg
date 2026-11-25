//! Pure frame sampling for IR ranges and verification diffs.

import type { MediaIRDiff, MediaIRFrameRange } from "@superimg/types";

/** Both sides of each half-open range boundary, sorted, unique and clock-bounded. */
export function selectBoundaryFrames(
  ranges: readonly MediaIRFrameRange[],
  totalFrames: number,
): number[] {
  if (!Number.isSafeInteger(totalFrames) || totalFrames < 1) {
    throw new TypeError("totalFrames must be a positive safe integer");
  }
  const frames = new Set<number>();
  for (const { startFrame, endFrame } of ranges) {
    for (const frame of [startFrame - 1, startFrame, endFrame - 1, endFrame]) {
      if (Number.isSafeInteger(frame) && frame >= 0 && frame < totalFrames) frames.add(frame);
    }
  }
  return [...frames].sort((a, b) => a - b);
}

export interface SelectVerificationFramesOptions {
  /** Max frames to return (default 64). */
  limit?: number;
}

/**
 * For each affected range: first, midpoint, last-inclusive (endFrame-1),
 * plus range boundaries from changes. Deduped, sorted, capped.
 */
export function selectVerificationFrames(
  diff: MediaIRDiff,
  options: SelectVerificationFramesOptions = {},
): number[] {
  const limit = options.limit ?? 64;
  const set = new Set<number>();

  const consider = (range: MediaIRFrameRange) => {
    if (range.endFrame <= range.startFrame) return;
    set.add(range.startFrame);
    const last = range.endFrame - 1;
    if (last >= range.startFrame) set.add(last);
    const mid = Math.floor((range.startFrame + last) / 2);
    set.add(mid);
  };

  for (const r of diff.affectedFrames) consider(r);
  for (const c of diff.changes) {
    for (const r of c.affected) consider(r);
  }

  const frames = [...set].filter((f) => f >= 0).sort((a, b) => a - b);
  if (frames.length <= limit) return frames;

  // Keep endpoints of overall span + evenly sample middle
  if (limit <= 2) return frames.slice(0, limit);
  const out: number[] = [frames[0]!];
  const inner = limit - 2;
  for (let i = 1; i <= inner; i++) {
    const idx = Math.round((i * (frames.length - 1)) / (limit - 1));
    out.push(frames[idx]!);
  }
  out.push(frames[frames.length - 1]!);
  return [...new Set(out)].sort((a, b) => a - b).slice(0, limit);
}
