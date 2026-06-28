//! Per-frame stdlib binding — video sync and scale helpers.

import type { Stdlib } from "@superimg/types";
import { sync as videoSync, type ClipSyncOptions } from "@superimg/stdlib/video";
import type { StaticStdlib } from "./stdlib.js";

export interface TimingWindow {
  fps: number;
  frame: number;
  totalFrames: number;
  progress: number;
  timeSeconds: number;
  durationSeconds: number;
}

export function bindStdTiming(
  base: StaticStdlib,
  window: TimingWindow,
  scale = 1,
): Stdlib {
  return {
    ...base,
    px: (value: number) => `${value * scale}px`,
    scale,
    video: {
      sync: (opts: ClipSyncOptions) => videoSync(opts, window.fps),
    },
  };
}