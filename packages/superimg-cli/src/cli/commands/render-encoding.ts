import type { EncodingOptions, OutputFormat as MediaOutputFormat } from "@superimg/types";
import type { RenderOptions } from "./render-targets.js";

export type OutputFormat = MediaOutputFormat | undefined;

import { PRORES_MASTER_ENCODING, PRORES_MASTER_ALPHA_ENCODING } from "@superimg/types";
export { PRORES_MASTER_ENCODING, PRORES_MASTER_ALPHA_ENCODING } from "@superimg/types";

export function buildEncodingOptions(opts: RenderOptions): EncodingOptions | undefined {
  const hasEncoding =
    opts.quality ||
    opts.alpha ||
    opts.videoQuantizer ||
    opts.preset ||
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
    opts.gifDither ||
    opts.dpr ||
    opts.capture ||
    opts.captureCache === true ||
    opts.stillQuality ||
    opts.lossless === true ||
    opts.colorProfile ||
    opts.deband ||
    opts.debandStrength ||
    opts.stillBitDepth;

  const hasCapture =
    opts.dpr ||
    opts.capture ||
    opts.captureCache === true ||
    opts.stillQuality ||
    opts.lossless === true ||
    opts.colorProfile ||
    opts.deband ||
    opts.debandStrength ||
    opts.stillBitDepth;

  if (!hasEncoding && !hasCapture) return undefined;

  const encoding: EncodingOptions = {};
  const validVideoCodecs = ["avc", "vp9", "av1", "prores"];
  const validAudioCodecs = ["aac", "opus", "dts"];
  const validQuality = ["very-low", "low", "medium", "high", "very-high"];
  const validBitrateModes = ["constant", "variable"];
  const validLatencyModes = ["quality", "realtime"];
  const validHwAccel = ["no-preference", "prefer-hardware", "prefer-software"];
  const validFastStart = ["false", "in-memory", "fragmented"];

  if (opts.preset) {
    if (opts.preset === "prores-master") Object.assign(encoding, PRORES_MASTER_ENCODING);
    else if (opts.preset === "prores-master-alpha") Object.assign(encoding, PRORES_MASTER_ALPHA_ENCODING);
    else throw new TypeError(`Unknown encoding preset "${opts.preset}". Valid: prores-master, prores-master-alpha.`);
  }

  if (opts.quality || opts.alpha || opts.videoQuantizer || opts.videoCodec || opts.videoBitrate || opts.keyframeInterval || opts.bitrateMode || opts.latencyMode || opts.hardwareAccel) {
    encoding.video = { ...encoding.video };
    if (opts.videoCodec) {
      const codec = opts.videoCodec.toLowerCase();
      if (!validVideoCodecs.includes(codec)) throw new TypeError(`Unknown video codec "${opts.videoCodec}". Valid: ${validVideoCodecs.join(", ")}.`);
      encoding.video.codec = codec as "avc" | "vp9" | "av1" | "prores";
    }
    if (opts.videoBitrate && (opts.quality || opts.videoQuantizer)) throw new TypeError("--video-bitrate cannot be combined with --quality or --video-quantizer.");
    if (opts.videoQuantizer && opts.quality) throw new TypeError("--video-quantizer cannot be combined with --quality.");
    if (opts.videoBitrate) {
      const bps = Number(opts.videoBitrate);
      if (!Number.isSafeInteger(bps) || bps <= 0) throw new TypeError("--video-bitrate must be a positive integer.");
      encoding.video.quality = { bitrate: bps };
    } else if (opts.quality) {
      if (!validQuality.includes(opts.quality)) throw new TypeError(`Unknown quality "${opts.quality}". Valid: ${validQuality.join(", ")}.`);
      encoding.video.quality = opts.quality as "very-low" | "low" | "medium" | "high" | "very-high";
    }
    if (opts.videoQuantizer) {
      const quantizer = Number(opts.videoQuantizer);
      if (!Number.isFinite(quantizer) || quantizer < 0) throw new TypeError("--video-quantizer must be nonnegative.");
      encoding.video.quality = { quantizer };
    }
    if (opts.alpha) {
      if (opts.alpha !== "keep" && opts.alpha !== "discard") throw new TypeError("--alpha must be keep or discard.");
      encoding.video.alpha = opts.alpha;
    }
    if (opts.keyframeInterval) {
      const sec = Number(opts.keyframeInterval);
      if (!Number.isFinite(sec) || sec <= 0) throw new TypeError("--keyframe-interval must be positive");
      encoding.video.keyFrameInterval = sec;
    }
    if (opts.bitrateMode) {
      const mode = opts.bitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        if (encoding.video.quality && typeof encoding.video.quality !== "string" && "bitrate" in encoding.video.quality) {
          encoding.video.quality = { ...encoding.video.quality, mode: mode as "constant" | "variable" };
        } else {
          throw new TypeError("--bitrate-mode requires --video-bitrate.");
        }
      } else {
        throw new TypeError(`Unknown bitrate mode "${opts.bitrateMode}". Valid: ${validBitrateModes.join(", ")}.`);
      }
    }
    if (opts.latencyMode) {
      const mode = opts.latencyMode.toLowerCase();
      if (validLatencyModes.includes(mode)) {
        encoding.video.latencyMode = mode as "quality" | "realtime";
      } else {
        throw new TypeError(`Warning: Unknown latency mode "${opts.latencyMode}". Valid: ${validLatencyModes.join(", ")}. `);
      }
    }
    if (opts.hardwareAccel) {
      const hint = opts.hardwareAccel.toLowerCase();
      if (validHwAccel.includes(hint)) {
        encoding.video.hardwareAcceleration = hint as "no-preference" | "prefer-hardware" | "prefer-software";
      } else {
        throw new TypeError(`Warning: Unknown hardware acceleration "${opts.hardwareAccel}". Valid: ${validHwAccel.join(", ")}. `);
      }
    }
  }

  if (opts.audioCodec || opts.audioBitrate || opts.audioBitrateMode) {
    encoding.audio = { ...encoding.audio };
    if (opts.audioCodec) {
      const codec = opts.audioCodec.toLowerCase();
      if (validAudioCodecs.includes(codec)) {
        encoding.audio.codec = codec as "aac" | "opus" | "dts";
      } else throw new TypeError(`Unknown audio codec "${opts.audioCodec}". Valid: ${validAudioCodecs.join(", ")}.`);
    }
    if (opts.audioBitrate) {
      const bps = Number(opts.audioBitrate);
      if (!Number.isSafeInteger(bps) || bps <= 0) throw new TypeError("--audio-bitrate must be a positive integer.");
      encoding.audio.quality = { bitrate: bps };
    }
    if (opts.audioBitrateMode) {
      const mode = opts.audioBitrateMode.toLowerCase();
      if (validBitrateModes.includes(mode)) {
        if (encoding.audio.quality && typeof encoding.audio.quality !== "string" && "bitrate" in encoding.audio.quality) {
          encoding.audio.quality = { ...encoding.audio.quality, mode: mode as "constant" | "variable" };
        } else throw new TypeError("--audio-bitrate-mode requires --audio-bitrate.");
      } else throw new TypeError(`Unknown audio bitrate mode "${opts.audioBitrateMode}". Valid: ${validBitrateModes.join(", ")}.`);
    }
  }

  if (opts.fastStart) {
    const mode = opts.fastStart.toLowerCase();
    if (validFastStart.includes(mode)) {
      encoding.mp4 = {
        fastStart: mode === "false" ? false : mode as "in-memory" | "fragmented",
      };
    } else {
      throw new TypeError(`Warning: Unknown fast start mode "${opts.fastStart}". Valid: ${validFastStart.join(", ")}. `);
    }
  }

  if (opts.clusterDuration) {
    const sec = Number(opts.clusterDuration);
    if (!Number.isFinite(sec) || sec < 0) throw new TypeError("--cluster-duration must be nonnegative");
    encoding.webm = { minimumClusterDuration: sec };
  }

  if (opts.maxColors || opts.gifLoop || opts.gifDither) {
    encoding.gif = {};
    if (opts.maxColors) {
      const n = Number(opts.maxColors);
      if (!isNaN(n) && n >= 2 && n <= 256) encoding.gif.maxColors = n;
      else throw new TypeError(`Warning: --max-colors must be 2-256. Using default (256).`);
    }
    if (opts.gifLoop) {
      const n = Number(opts.gifLoop);
      if (!isNaN(n)) encoding.gif.loop = n;
    }
    if (opts.gifDither) {
      encoding.gif.dither = opts.gifDither;
    }
  }

  // Capture fidelity (orthogonal to video bitrate --quality)
  if (opts.dpr || opts.capture || opts.captureCache === true || opts.colorProfile) {
    encoding.capture = {};
    if (opts.captureCache === true) encoding.capture.cache = true;
    if (opts.dpr) {
      const dpr = Number(opts.dpr);
      if (!isNaN(dpr) && dpr > 0 && dpr <= 4) encoding.capture.dpr = dpr;
      else throw new TypeError(`Warning: --dpr must be 0–4. Using format default.`);
    }
    if (opts.capture) {
      const c = opts.capture.toLowerCase();
      if (c === "png" || c === "jpeg") encoding.capture.intermediate = c;
      else throw new TypeError(`Warning: --capture must be png or jpeg. `);
    }
    if (opts.colorProfile) {
      const p = opts.colorProfile.toLowerCase();
      if (p === "srgb" || p === "display-p3") encoding.capture.colorProfile = p;
      else throw new TypeError(`Warning: --color-profile must be srgb or display-p3.`);
    }
  }

  if (
    opts.stillQuality ||
    opts.lossless === true ||
    opts.deband ||
    opts.debandStrength ||
    opts.stillBitDepth
  ) {
    encoding.still = {};
    if (opts.stillQuality) {
      const q = Number(opts.stillQuality);
      if (!isNaN(q) && q >= 1 && q <= 100) encoding.still.quality = q;
      else throw new TypeError(`Warning: --still-quality must be 1–100.`);
    }
    if (opts.lossless === true) encoding.still.lossless = true;
    if (opts.deband) {
      const d = opts.deband.toLowerCase();
      if (d === "none" || d === "blue-noise" || d === "white-noise") {
        encoding.still.deband = d;
      } else {
        throw new TypeError(
          `Warning: --deband must be none, blue-noise, or white-noise.`,
        );
      }
    }
    if (opts.debandStrength) {
      const s = Number(opts.debandStrength);
      if (!isNaN(s) && s >= 0 && s <= 1) encoding.still.debandStrength = s;
      else throw new TypeError(`Warning: --deband-strength must be 0–1.`);
    }
    if (opts.stillBitDepth) {
      const b = Number(opts.stillBitDepth);
      if (b === 8 || b === 16) encoding.still.bitDepth = b;
      else throw new TypeError(`Warning: --still-bit-depth must be 8 or 16.`);
    }
  }

  return encoding;
}
