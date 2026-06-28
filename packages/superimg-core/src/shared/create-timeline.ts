//! Build unified Timeline snapshot from frame parameters.

import type { Timeline } from "@superimg/types";

export function createTimeline(
  frame: number,
  fps: number,
  totalFrames: number,
): Timeline {
  const progress =
    totalFrames > 1
      ? Math.min(frame / (totalFrames - 1), 1.0)
      : totalFrames === 1
        ? 1.0
        : 0.0;
  const durationSeconds = totalFrames / fps;
  const seconds = progress * durationSeconds;

  return {
    frame,
    fps,
    progress,
    seconds,
    durationSeconds,
    totalFrames,
  };
}