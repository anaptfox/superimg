import type { ResolveCue } from "@superimg/types";
import { parseDuration } from "../shared/utils.js";

/** A film-authored cue on the effective media clock, in seconds. */
export interface NormalizedCue {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly stillSeconds: number;
}

/** Normalize and order cues, clamping stills to the last renderable moment. */
export function normalizeCues(cues: readonly ResolveCue[], fps: number, durationSeconds: number): readonly NormalizedCue[] {
  const lastMoment = Math.max(0, durationSeconds - 1 / fps);
  return Object.freeze(cues.map((cue) => {
    const start = parseDuration(cue.start, `cue ${cue.id} start`, fps);
    const end = parseDuration(cue.end, `cue ${cue.id} end`, fps);
    if (end < start) throw new RangeError(`Cue ${JSON.stringify(cue.id)} ends before it starts.`);
    const still = cue.still === undefined ? (start + end) / 2 : parseDuration(cue.still, `cue ${cue.id} still`, fps);
    return Object.freeze({ id: cue.id, startSeconds: start, endSeconds: end, stillSeconds: Math.min(Math.max(still, 0), lastMoment) });
  }).sort((a, b) => a.startSeconds - b.startSeconds));
}
