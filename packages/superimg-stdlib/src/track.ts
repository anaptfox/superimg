/**
 * Track — unified sync surface for transcripts and markers on the scene timeline.
 */

import type { Timeline } from "@superimg/types";
import { markers as cueMarkers } from "./cue/markers.js";
import { transcript as cueTranscript } from "./cue/transcript.js";
import type { TranscriptWord } from "./cue/types.js";

export interface TrackSource {
  words?: TranscriptWord[];
  markers?: Record<string, number>;
}

export interface Track {
  readonly seconds: number;
  transcript(): ReturnType<typeof cueTranscript>;
  markers(): ReturnType<typeof cueMarkers>;
}

export function createTrack(timeline: Timeline, source: TrackSource): Track {
  const words = source.words ?? [];
  const markerBook = source.markers ?? {};

  return {
    get seconds() {
      return timeline.seconds;
    },
    transcript() {
      return cueTranscript(words, timeline.seconds);
    },
    markers() {
      return cueMarkers(markerBook, timeline.seconds);
    },
  };
}