//! Audio timeline types — serializable clip model for mix + future editor

import type { Duration } from "./types.js";

export type AudioRole = "music" | "voice" | "sfx" | "ambient";

/** Word-level timing co-located with voice clips */
export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

/** Editor / future-TTS seam. Foundation renders `file` only. */
export type AudioSource =
  | { kind: "file"; src: string }
  | { kind: "recording"; id: string }
  | {
      kind: "speech";
      provider: "elevenlabs";
      text: string;
      voiceId: string;
      modelId?: string;
    };

export interface AudioClip {
  id?: string;
  label?: string;
  showInTimeline?: boolean;
  src: string;
  source?: AudioSource;
  role?: AudioRole;
  at?: Duration;
  atScene?: string;
  trim?: { in?: Duration; out?: Duration };
  duration?: Duration;
  loop?: boolean;
  volume?: number;
  fadeIn?: Duration;
  fadeOut?: Duration;
  transcript?: TranscriptWord[];
}

export interface AudioMixOptions {
  master?: number;
  ducking?: boolean;
  duckingLevel?: number;
  duckingAttack?: number;
  duckingRelease?: number;
}

export interface AudioTimeline {
  clips: AudioClip[];
  mix?: AudioMixOptions;
}

export type AudioValue = AudioClip | AudioClip[] | AudioTimeline;

/** Reserved for future speech synth — type only in this epic */
export interface DocumentaryScript {
  voiceId: string;
  modelId?: string;
  scenes: Array<{ sceneId: string; text: string }>;
}

/** Resolved clip after placement — used by encoders and timeline model */
export interface ResolvedAudioClip {
  id: string;
  label?: string;
  showInTimeline: boolean;
  src: string;
  role: AudioRole;
  atSeconds: number;
  placementDurationSeconds: number;
  trimInSeconds: number;
  trimOutSeconds: number | null;
  loop: boolean;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  transcript?: TranscriptWord[];
}

export interface ResolvedAudioMix {
  master: number;
  ducking: boolean;
  duckingLevel: number;
  duckingAttack: number;
  duckingRelease: number;
}

export interface ResolvedAudioTimeline {
  clips: ResolvedAudioClip[];
  mix: ResolvedAudioMix;
  videoDurationSeconds: number;
}