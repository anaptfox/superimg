import type { EncodingOptions } from "@superimg/types";
import type { RenderOptions } from "./render-targets.js";

export type OutputFormat = "mp4" | "webm" | "gif" | "png" | "webp" | "jpeg" | "svg" | "html" | undefined;

const VALID_FORMATS = [
  "mp4", "webm", "gif", "png", "webp", "jpeg", "svg", "html",
] as const satisfies readonly Exclude<NonNullable<OutputFormat>, undefined>[];

export function resolveFormat(opts: RenderOptions): OutputFormat {
  if (opts.format) {
    const f = opts.format.toLowerCase() as OutputFormat;
    if (VALID_FORMATS.includes(f as typeof VALID_FORMATS[number])) return f;
    console.warn(`Warning: Unknown format "${opts.format}". Valid: ${VALID_FORMATS.join(", ")}. Using default.`);
    return undefined;
  }
  if (opts.output?.endsWith(".webm")) return "webm";
  if (opts.output?.endsWith(".gif")) return "gif";
  if (opts.output?.endsWith(".png")) return "png";
  if (opts.output?.endsWith(".webp")) return "webp";
  if (opts.output?.endsWith(".jpg") || opts.output?.endsWith(".jpeg")) return "jpeg";
  if (opts.output?.endsWith(".svg")) return "svg";
  if (opts.output?.endsWith(".html")) return "html";
  return undefined;
}

export function buildEncodingOptions(opts: RenderOptions): EncodingOptions | undefined {
  const format = resolveFormat(opts);
  const hasEncoding =
    format ||
    opts.quality ||
    opts.videoCodec ||
    opts.videoBitrate ||
    opts.audioCodec ||
    opts.audioBitrate ||
    opts.keyframeInterval ||
    opts.bitrateMode ||
    opts.latencyMode ||
    opts.hardwareAccel ||
    opts.audioBitrateMode ||
    opts.fastStart ||
    opts.clusterDuration ||
    opts.maxColors ||
    opts.gifLoop ||
    opts.gifDither;

  if (!hasEncoding) return undefined;

  const encoding: EncodingOptions = {};
  if (format) encoding.format = format;
  const validVideoCodecs = ["avc", "vp9", "av1"];
  const validAudioCodecs = ["aac", "opus"];
  const validQuality = ["very-low", "low", "medium", "high", "very-high"];
  const validBitrateModes = ["constant", "variable"];
  const validLatencyModes = ["quality", "realtime"];
  const validHwAccel = ["no-preference", "prefer-hardware", "prefer-software"];
  const validFastStart = ["false", "in-memory", "fragmented"];

  if (opts.quality || opts.videoCodec || opts.videoBitrate || opts.keyframeInterval || opts.bitrateMode || opts.latencyMode || opts.hardwareAccel) {
    encoding.video = {};
    if (opts.videoCodec) {
      const codec = opts.videoCodec.toLowerCase();
      if (validVideoCodecs.includes(codec)) {
        encoding.video.codec = codec as "avc" | "vp9" | "av1";
      } else {
        console.warn(`Warning: Unknown video codec "${opts.videoCodec}". Valid: ${validVideoCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.videoBitrate) {
      const bps = parseInt(opts.videoBitrate, 10);
      if (!isNaN(bps)) encoding.video.bitrate = bps;
    } else if (opts.quality) {
      if (validQuality.includes(opts.quality)) {
        encoding.video.bitrate = opts.quality as "very-low" | "low" | "medium" | "high" | "very-high";
      } else {
        console.warn(`Warning: Unknown quality "${opts.quality}". Valid: ${validQuality.join(", ")}. Using default.`);
      }
    }
    if (opts.keyframeInterval) {
      const sec = parseFloat(opts.keyframeInterval);
      if (!isNaN(sec)) encoding.video.keyFrameInterval = sec;
    }
    if (opts.bitrateMode) {
      const mode = opts.bitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        encoding.video.bitrateMode = mode as "constant" | "variable";
      } else {
        console.warn(`Warning: Unknown bitrate mode "${opts.bitrateMode}". Valid: ${validBitrateModes.join(", ")}. Using default.`);
      }
    }
    if (opts.latencyMode) {
      const mode = opts.latencyMode.toLowerCase();
      if (validLatencyModes.includes(mode)) {
        encoding.video.latencyMode = mode as "quality" | "realtime";
      } else {
        console.warn(`Warning: Unknown latency mode "${opts.latencyMode}". Valid: ${validLatencyModes.join(", ")}. Using default.`);
      }
    }
    if (opts.hardwareAccel) {
      const hint = opts.hardwareAccel.toLowerCase();
      if (validHwAccel.includes(hint)) {
        encoding.video.hardwareAcceleration = hint as "no-preference" | "prefer-hardware" | "prefer-software";
      } else {
        console.warn(`Warning: Unknown hardware acceleration "${opts.hardwareAccel}". Valid: ${validHwAccel.join(", ")}. Using default.`);
      }
    }
  }

  if (opts.audioCodec || opts.audioBitrate || opts.audioBitrateMode) {
    encoding.audio = {};
    if (opts.audioCodec) {
      const codec = opts.audioCodec.toLowerCase();
      if (validAudioCodecs.includes(codec)) {
        encoding.audio.codec = codec as "aac" | "opus";
      } else {
        console.warn(`Warning: Unknown audio codec "${opts.audioCodec}". Valid: ${validAudioCodecs.join(", ")}. Using default.`);
      }
    }
    if (opts.audioBitrate) {
      const bps = parseInt(opts.audioBitrate, 10);
      if (!isNaN(bps)) encoding.audio.bitrate = bps;
    }
    if (opts.audioBitrateMode) {
      const mode = opts.audioBitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        encoding.audio.bitrateMode = mode as "constant" | "variable";
      } else {
        console.warn(`Warning: Unknown audio bitrate mode "${opts.audioBitrateMode}". Valid: ${validBitrateModes.join(", ")}. Using default.`);
      }
    }
  }

  if (opts.fastStart) {
    const mode = opts.fastStart.toLowerCase();
    if (validFastStart.includes(mode)) {
      encoding.mp4 = {
        fastStart: mode === "false" ? false : mode as "in-memory" | "fragmented",
      };
    } else {
      console.warn(`Warning: Unknown fast start mode "${opts.fastStart}". Valid: ${validFastStart.join(", ")}. Using default.`);
    }
  }

  if (opts.clusterDuration) {
    const sec = parseFloat(opts.clusterDuration);
    if (!isNaN(sec)) {
      encoding.webm = { minimumClusterDuration: sec };
    }
  }

  if (opts.maxColors || opts.gifLoop || opts.gifDither) {
    encoding.gif = {};
    if (opts.maxColors) {
      const n = parseInt(opts.maxColors, 10);
      if (!isNaN(n) && n >= 2 && n <= 256) encoding.gif.maxColors = n;
      else console.warn(`Warning: --max-colors must be 2-256. Using default (256).`);
    }
    if (opts.gifLoop) {
      const n = parseInt(opts.gifLoop, 10);
      if (!isNaN(n)) encoding.gif.loop = n;
    }
    if (opts.gifDither) {
      encoding.gif.dither = opts.gifDither;
    }
  }

  // Apply WebM smart defaults when no explicit video options were set
  if (format === "webm") {
    if (!encoding.video) encoding.video = {};
    if (!encoding.video.codec) encoding.video.codec = ["vp9", "av1"];
  }

  return encoding;
}
