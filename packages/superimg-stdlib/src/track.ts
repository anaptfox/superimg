/**
 * Track — unified sync surface for transcripts and markers on the scene timeline.
 */

import type { Timeline } from "@superimg/types";
import { markers as cueMarkers } from "./cue/markers.js";
import { transcript as cueTranscript } from "./cue/transcript.js";
import type { TranscriptWord } from "./cue/types.js";

export interface TrackSource {
  /** Stable track id — required for Media IR compile. */
  id?: string;
  words?: TranscriptWord[];
  markers?: Record<string, number>;
}

export interface TrackInstrument {
  strictIds?: boolean;
  sceneId?: string;
  frame?: number;
  sceneStartFrame?: number;
  totalFrames?: number;
  onTrack?(event: {
    localId: string;
    sceneId: string;
    kind: "author-track" | "transcript" | "markers";
    wordCount?: number;
    markerCount?: number;
    frame: number;
    sceneStartFrame: number;
    totalFrames: number;
  }): void;
  onIssue?(issue: {
    code: string;
    message: string;
    sceneId?: string;
    id?: string;
    frame?: number;
  }): void;
}

export interface Track {
  readonly seconds: number;
  readonly id: string | undefined;
  transcript(): ReturnType<typeof cueTranscript>;
  markers(): ReturnType<typeof cueMarkers>;
}

export function createTrack(
  timeline: Timeline,
  source: TrackSource,
  instrument?: TrackInstrument,
): Track {
  const words = source.words ?? [];
  const markerBook = source.markers ?? {};

  if (instrument?.onTrack) {
    if (!source.id) {
      if (instrument.strictIds) {
        throw new Error(`ctx.track: missing required id (Media IR). Pass id: "voiceover"`);
      }
      instrument.onIssue?.({
        code: "anonymous_id",
        message: "ctx.track has no stable id; track semantics are sampled",
        sceneId: instrument.sceneId ?? "default",
        frame: instrument.frame ?? timeline.frame,
      });
    } else {
      instrument.onTrack({
        localId: source.id,
        sceneId: instrument.sceneId ?? "default",
        kind:
          words.length > 0 && Object.keys(markerBook).length === 0
            ? "transcript"
            : words.length === 0 && Object.keys(markerBook).length > 0
              ? "markers"
              : "author-track",
        wordCount: words.length,
        markerCount: Object.keys(markerBook).length,
        frame: instrument.frame ?? timeline.frame,
        sceneStartFrame: instrument.sceneStartFrame ?? 0,
        totalFrames: instrument.totalFrames ?? timeline.totalFrames,
      });
    }
  }

  return {
    get seconds() {
      return timeline.seconds;
    },
    id: source.id,
    transcript() {
      return cueTranscript(words, timeline.seconds);
    },
    markers() {
      return cueMarkers(markerBook, timeline.seconds);
    },
  };
}
