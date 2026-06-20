export type VideoCodecPreference = "avc" | "vp9" | "av1";
export type AudioCodecPreference = "aac" | "opus";
export type QualityPreset = "very-low" | "low" | "medium" | "high" | "very-high";
export type OutputFormat = "mp4" | "webm" | "gif" | "png" | "webp" | "jpeg" | "svg" | "html";
export type BitrateMode = "constant" | "variable";
export type LatencyMode = "quality" | "realtime";
export type HardwareAcceleration = "no-preference" | "prefer-hardware" | "prefer-software";

export interface EncodingOptions {
  format?: OutputFormat;
  video?: {
    codec?: VideoCodecPreference | VideoCodecPreference[];
    bitrate?: number | QualityPreset;
    bitrateMode?: BitrateMode;
    keyFrameInterval?: number;
    alpha?: "discard" | "keep";
    latencyMode?: LatencyMode;
    hardwareAcceleration?: HardwareAcceleration;
  };
  audio?: {
    codec?: AudioCodecPreference | AudioCodecPreference[];
    bitrate?: number | QualityPreset;
    bitrateMode?: BitrateMode;
  };
  mp4?: {
    fastStart?: false | "in-memory" | "fragmented";
  };
  webm?: {
    minimumClusterDuration?: number;
  };
  gif?: {
    maxColors?: number;
    loop?: number;
    dither?: string;
  };
}
