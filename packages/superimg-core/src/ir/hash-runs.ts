//! RLE compression of per-frame hash sequences into MediaIRHashRun[].

import type { MediaIRHashRun } from "@superimg/types";

/** Collapse consecutive equal hashes into half-open frame ranges. */
export function rleHashRuns(
  frames: { frame: number; hash: string }[],
): MediaIRHashRun[] {
  if (frames.length === 0) return [];
  const runs: MediaIRHashRun[] = [];
  let start = frames[0]!.frame;
  let hash = frames[0]!.hash;
  let prev = start;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.hash === hash && f.frame === prev + 1) {
      prev = f.frame;
      continue;
    }
    runs.push({ range: { startFrame: start, endFrame: prev + 1 }, hash });
    start = f.frame;
    hash = f.hash;
    prev = f.frame;
  }
  runs.push({ range: { startFrame: start, endFrame: prev + 1 }, hash });
  return runs;
}
