//! Per-frame stdlib binding — attaches scene-local score() to the static stdlib.

import type { Stdlib } from "@superimg/types";
import { createScore } from "@superimg/stdlib/score";
import type { PhaseConfig } from "@superimg/stdlib/score";
import { sync as videoSync, type VideoSyncOptions } from "@superimg/stdlib/video";
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
  const scoreCtx = {
    sceneProgress: window.progress,
    sceneTimeSeconds: window.timeSeconds,
    sceneDurationSeconds: window.durationSeconds,
    fps: window.fps,
  };

  return {
    ...base,
    px: (value: number) => `${value * scale}px`,
    scale,
    score: <P extends PhaseConfig | undefined = undefined>(phases?: P) =>
      createScore(scoreCtx, phases),
    video: {
      sync: (opts: VideoSyncOptions) => videoSync(opts, window.fps),
    },
  };
}