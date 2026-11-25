//! Nested director clips (Remotion-style sequence windows).

import type { Timeline } from "@superimg/types";
import { clamp01 } from "../easing.js";
import { parseMotionTime } from "./phases.js";
import type {
  ClipOpts,
  DirectorClip,
  DirectorContext,
  DirectorOf,
  NormalizedPhase,
  PhaseConfig,
} from "./types.js";

type MakeDirector = <P extends PhaseConfig | undefined = undefined>(
  ctx: DirectorContext,
  phases?: P,
) => DirectorOf<P>;

export interface ClipWindow {
  start: number;
  end: number;
}

export function resolveClipWindow(
  opts: ClipOpts,
  parentWindow: ClipWindow,
  parentDurationSeconds: number,
  phaseMap?: Map<string, NormalizedPhase>,
): ClipWindow {
  if (opts.during) {
    if (Array.isArray(opts.during)) {
      const [startSec, endSec] = opts.during;
      if (typeof startSec !== "number" || typeof endSec !== "number" || !(endSec > startSec)) {
        throw new Error("director.clip({ during }) window must be [startSec, endSec]");
      }
      return { start: startSec / parentDurationSeconds, end: endSec / parentDurationSeconds };
    }
    if (!phaseMap) {
      throw new Error('director.clip({ during }) requires a director with named phases');
    }
    if (typeof opts.during !== "string") {
      throw new Error("director.clip({ during }) must be a phase name or [startSec, endSec]");
    }
    const p = phaseMap.get(opts.during);
    if (!p) {
      throw new Error(
        `director.clip: unknown phase "${opts.during}". Known: ${[...phaseMap.keys()].join(", ")}`,
      );
    }
    return { start: p.start, end: p.end };
  }

  if (opts.duration === undefined) {
    throw new Error("director.clip() requires `duration` or `during`");
  }

  const parentSpan = parentWindow.end - parentWindow.start;
  const fromOffset =
    opts.from === undefined
      ? 0
      : parseMotionTime(opts.from, parentSpan, parentDurationSeconds);

  const durationSpan = parseMotionTime(opts.duration!, parentSpan, parentDurationSeconds);

  const start = parentWindow.start + fromOffset;
  return { start, end: start + durationSpan };
}

export function createDirectorClip(
  sceneCtx: DirectorContext,
  window: ClipWindow,
  phaseMap: Map<string, NormalizedPhase> | undefined,
  makeDirector: MakeDirector,
): DirectorClip {
  const { timeline } = sceneCtx;
  const fps = sceneCtx.fps ?? 30;

  const clipFn = (opts: ClipOpts): DirectorClip => {
    const child = resolveClipWindow(opts, window, timeline.durationSeconds, phaseMap);
    return createDirectorClip(sceneCtx, child, phaseMap, makeDirector);
  };

  const clipProgress = () => {
    const s = window.end - window.start;
    return s <= 0 ? 0 : clamp01((timeline.progress - window.start) / s);
  };

  return {
    get active() {
      return timeline.progress >= window.start && timeline.progress < window.end;
    },
    get progress() {
      return clipProgress();
    },
    get frame() {
      const p = clipProgress();
      const s = window.end - window.start;
      const sec = p * s * timeline.durationSeconds;
      const tf = Math.max(1, Math.ceil(s * timeline.durationSeconds * fps));
      return Math.min(tf - 1, Math.floor(sec * fps));
    },
    get seconds() {
      const p = clipProgress();
      const s = window.end - window.start;
      return p * s * timeline.durationSeconds;
    },
    get durationSeconds() {
      return (window.end - window.start) * timeline.durationSeconds;
    },
    get totalFrames() {
      return Math.max(1, Math.ceil((window.end - window.start) * timeline.durationSeconds * fps));
    },
    director<P extends PhaseConfig | undefined = undefined>(phases?: P): DirectorOf<P> {
      const p = clipProgress();
      const s = window.end - window.start;
      const childTimeline: Timeline = {
        frame: timeline.frame,
        fps,
        progress: p,
        seconds: p * s * timeline.durationSeconds,
        durationSeconds: s * timeline.durationSeconds,
        totalFrames: Math.max(1, Math.ceil(s * timeline.durationSeconds * fps)),
      };
      // Forward IR sink so nested clip directors record motions/phases.
      return makeDirector(
        {
          timeline: childTimeline,
          fps,
          ...(sceneCtx.instrument ? { instrument: sceneCtx.instrument } : {}),
        },
        phases,
      );
    },
    clip: clipFn,
  };
}
