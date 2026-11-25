import type { AudioTimeline, TranscriptWord } from "./audio.js";

/** Timing constraints contain seconds, never provider-specific speech rates. */
export interface NarrationSegmentTiming {
  id: string;
  beforeSeconds?: number;
  afterSeconds?: number;
  budgetSeconds?: number;
}

export interface MeasuredNarrationSegment extends NarrationSegmentTiming {
  src: string;
  sampleRate: number;
  sampleFrames: number;
  transcript?: TranscriptWord[];
}

export interface NarrationTimingOptions {
  mode: "natural" | "fixed";
  fps: number;
}

export interface NarrationPlanSegment {
  id: string;
  startFrame: number;
  endFrame: number;
  startSeconds: number;
  endSeconds: number;
  speechStartSeconds: number;
  speechDurationSeconds: number;
  paddingSeconds: number;
}

export interface NarrationFinding {
  code: "NARRATION_OVERFLOW";
  severity: "error";
  segmentId: string;
  overflowSeconds: number;
  message: string;
}

export interface NarrationPlan {
  schemaVersion: 1;
  kind: "narration-plan";
  mode: "natural" | "fixed";
  fps: number;
  totalFrames: number;
  durationSeconds: number;
  segments: NarrationPlanSegment[];
  /** Absolute scene phases. Values use explicit units for ctx.director(). */
  phases: Record<string, `${number}s`>;
  audio: AudioTimeline;
  findings: NarrationFinding[];
}
