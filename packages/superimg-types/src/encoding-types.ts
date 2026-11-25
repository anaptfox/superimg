export type VideoCodecPreference = "avc" | "vp9" | "av1" | "prores";
export type AudioCodecPreference = "aac" | "opus" | "dts" | "pcm-f32";
export type QualityPreset = "very-low" | "low" | "medium" | "high" | "very-high";
export type OutputFormat = "mp4" | "webm" | "mov" | "mkv" | "gif" | "png" | "webp" | "jpeg" | "svg" | "html";
export type BitrateMode = "constant" | "variable";
export type LatencyMode = "quality" | "realtime";
export type HardwareAcceleration = "no-preference" | "prefer-hardware" | "prefer-software";

/** Portable encoder-quality request. Codec-specific quantizer ranges are validated by adapters. */
export type EncodingQuality =
  | QualityPreset
  | Readonly<{ bitrate: number; mode?: BitrateMode }>
  | Readonly<{ quantizer: number }>;

export function normalizeEncodingQuality(value: EncodingQuality | undefined): EncodingQuality | undefined {
  if (value === undefined) return value;
  if (typeof value === "string") {
    if (!(["very-low", "low", "medium", "high", "very-high"] as const).includes(value as QualityPreset)) {
      throw new TypeError("Encoder quality preset is invalid");
    }
    return value;
  }
  if (value === null || typeof value !== "object" || ("bitrate" in value) === ("quantizer" in value)) {
    throw new TypeError("Encoder quality must contain exactly one of bitrate or quantizer");
  }
  if ("bitrate" in value) {
    if (!Number.isFinite(value.bitrate) || value.bitrate <= 0) {
      throw new TypeError("Encoder bitrate must be a positive finite number");
    }
    if (value.mode !== undefined && value.mode !== "constant" && value.mode !== "variable") {
      throw new TypeError("Encoder bitrate mode is invalid");
    }
    return Object.freeze({ bitrate: value.bitrate, ...(value.mode !== undefined ? { mode: value.mode } : {}) });
  }
  if (!Number.isFinite(value.quantizer) || value.quantizer < 0) {
    throw new TypeError("Encoder quantizer must be a non-negative finite number");
  }
  return Object.freeze({ quantizer: value.quantizer });
}

/**
 * Headless / browser capture fidelity (orthogonal to video bitrate `--quality`).
 * Layout size stays `width`×`height`; `dpr` + `scale` control physical buffer density.
 */
export interface CaptureOptions {
  /** Crop in CSS pixels relative to the authored frame. Output dimensions follow the region. */
  region?: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** Reconcile cloned browser layout. Supported by the SnapDOM backend only. */
  reconcile?: boolean;
  /** Opt-in unchanged capture reuse within this session. Playwright rechecks prepared static DOM, computed styles and geometry; dynamic content always captures. */
  cache?: boolean;
  /**
   * Intermediate screenshot codec.
   * Default: `"png"` for still formats and alpha; `"jpeg"` for opaque video.
   */
  intermediate?: "png" | "jpeg";
  /** JPEG quality 0–100 when intermediate is jpeg. Default 95. */
  jpegQuality?: number;
  /**
   * Playwright `deviceScaleFactor` / Snapdom dpr.
   * Default: `2` for still masters, `1` for video/gif coded size.
   */
  dpr?: number;
  /**
   * `"css"` — buffer equals CSS viewport (W×H).
   * `"device"` — buffer is viewport × dpr (use for still Retina masters).
   * Default: `"device"` when dpr &gt; 1 for stills; `"css"` for video.
   */
  scale?: "css" | "device";
  /** Chromium color profile lock. Default `"srgb"`. */
  colorProfile?: "srgb" | "display-p3";
}

/** Validate a region before allocating renderer or encoder resources. */
export function resolveCaptureRegion(width: number, height: number, capture?: CaptureOptions) {
  const region = capture?.region ?? { x: 0, y: 0, width, height };
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite)
    || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0
    || region.x + region.width > width || region.y + region.height > height) {
    throw new TypeError("Capture region must be a positive rectangle within the authored frame in CSS pixels");
  }
  return Object.freeze({ ...region });
}

/**
 * Quantization deband for 8-bit stills (smooth gradients).
 * - `none` — no extra noise
 * - `blue-noise` — interleaved gradient noise (IGN); natural, no Bayer grid
 * - `white-noise` — independent per-pixel noise (harsher)
 * Default for PNG apply path: `"blue-noise"`. Off for 16-bit masters.
 */
export type StillDebandMode = "none" | "blue-noise" | "white-noise";

/** Final still encode options for Sharp (png/webp/jpeg). */
export interface StillEncodeOptions {
  /** JPEG/WebP quality 1–100. Default 95 jpeg / lossless webp when lossless. */
  quality?: number;
  /** Prefer lossless WebP (and ignore lossy quality). Default true for webp masters. */
  lossless?: boolean;
  /** JPEG chroma. Default `"4:4:4"`. */
  chromaSubsampling?: "4:4:4" | "4:2:0";
  /**
   * PNG sample depth. `16` = archival master (rgb16); `8` = apply/wallpaper.
   * Deband only applies when writing 8-bit.
   */
  bitDepth?: 8 | 16;
  /** Gradient banding aid for 8-bit PNG/JPEG/WebP. Default `"blue-noise"` for png. */
  deband?: StillDebandMode;
  /** Deband amplitude 0–1 (default ~0.35). Maps to ~±0–3 levels at 8-bit. */
  debandStrength?: number;
  /**
   * PNG zlib level 0–9. Default 4 for 8-bit apply plates (fast enough, small
   * enough). 16-bit archival masters still use 9.
   */
  compressionLevel?: number;
}

export interface EncodingOptions {
  format?: OutputFormat;
  video?: {
    codec?: VideoCodecPreference | VideoCodecPreference[];
    quality?: EncodingQuality;
    keyFrameInterval?: number;
    alpha?: "discard" | "keep";
    latencyMode?: LatencyMode;
    hardwareAcceleration?: HardwareAcceleration;
  };
  audio?: {
    codec?: AudioCodecPreference | AudioCodecPreference[];
    quality?: EncodingQuality;
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
  /** Screenshot / DPR capture fidelity. */
  capture?: CaptureOptions;
  /** Still output encoder (png/webp/jpeg). */
  still?: StillEncodeOptions;
}

/** True when format is a single-frame still export. */
export function isStillOutputFormat(
  format: OutputFormat | string | undefined,
): boolean {
  return format === "png" || format === "webp" || format === "jpeg";
}

/**
 * Resolve capture defaults by output format.
 * Stills: dpr 2 + device scale (physical 2×). Video/gif: dpr 1 + css (coded W×H).
 */
export function resolveCaptureDefaults(
  format: OutputFormat | string | undefined,
  capture?: CaptureOptions,
  alphaKeep?: boolean,
): Required<Pick<CaptureOptions, "intermediate" | "jpegQuality" | "dpr" | "scale" | "colorProfile">> {
  const still = isStillOutputFormat(format);
  const dpr = capture?.dpr ?? (still ? 2 : 1);
  if (!Number.isFinite(dpr) || dpr <= 0) throw new TypeError("Capture DPR must be a positive finite number");
  if (capture?.jpegQuality !== undefined && (!Number.isFinite(capture.jpegQuality) || capture.jpegQuality < 0 || capture.jpegQuality > 100)) throw new TypeError("Capture JPEG quality must be between 0 and 100");
  const scale =
    capture?.scale ??
    (still && dpr > 1 ? "device" : "css");
  const intermediate =
    capture?.intermediate ??
    (still || alphaKeep ? "png" : "jpeg");
  return {
    intermediate,
    jpegQuality: capture?.jpegQuality ?? 95,
    dpr,
    scale,
    colorProfile: capture?.colorProfile ?? "srgb",
  };
}

/** Editing masters; source capture precision and color space remain unchanged. */
export const PRORES_MASTER_ENCODING = {
  format: "mov",
  capture: { intermediate: "png" },
  video: { codec: "prores", quality: "very-high", alpha: "discard" },
  audio: { codec: "aac", quality: "high" },
} as const satisfies EncodingOptions;

export const PRORES_MASTER_ALPHA_ENCODING = {
  ...PRORES_MASTER_ENCODING,
  video: { ...PRORES_MASTER_ENCODING.video, alpha: "keep" },
} as const satisfies EncodingOptions;

/** Container rules for preserving alpha in the supported video codecs. */
export function isAlphaCodecContainerCompatible(format: OutputFormat | undefined, codec: string): boolean {
  return codec === "vp9" ? format === "webm" || format === "mkv"
    : codec === "prores" && (format === "mov" || format === "mkv");
}
