import type { EncodingOptions, OutputFormat } from "./encoding-types.js";

/** Host-supplied media input. URLs are resolved by the selected runtime adapter. */
export type MediaInput =
  | Readonly<{ kind: "bytes"; bytes: Uint8Array; mimeType?: string }>
  | Readonly<{ kind: "url"; url: string }>;

export interface MediaTrackInspection {
  /** Opaque selection ID. Use the value returned by inspection for this source. */
  readonly id: string;
  readonly kind: "video" | "audio";
  readonly codec?: string;
  readonly durationSeconds?: number;
  /** Encoded frame dimensions, before display transformation. */
  readonly width?: number;
  readonly height?: number;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  /** Clockwise rotation, followed by horizontal flipping. */
  readonly rotation?: 0 | 90 | 180 | 270;
  readonly flip?: boolean;
  /** Row-major 3x3 display transform, including any container translation. */
  readonly transformationMatrix?: readonly [number, number, number, number, number, number, number, number, number];
  /** A format/codec hint that alpha may be present, not proof of transparent pixels. */
  readonly canBeTransparent?: boolean;
  readonly fps?: number;
  readonly channels?: number;
  readonly sampleRate?: number;
}

/** Content facts from a resolved input. It is separate from authored program identity. */
export interface MediaInspection {
  readonly schemaVersion: 0;
  readonly kind: "@foxworth/superimg/media-inspection";
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly durationSeconds?: number;
  readonly tracks: readonly MediaTrackInspection[];
}

/** SuperImg's track order is per kind. Demuxer IDs are private to the adapter. */
export function mediaTrackId(kind: MediaTrackInspection["kind"] | "subtitle", trackNumber: number): string {
  return `${kind}:${trackNumber}`;
}

/** Require a current track identifier from media inspection. */
export function resolveMediaTrackId(trackId: string): string {
  if (!/^\d+$/.test(trackId)) return trackId;
  throw new TypeError(`Legacy media track ID ${JSON.stringify(trackId)} cannot be matched safely. Inspect the source again and select a current track ID.`);
}

export function selectMediaTrack(inspection: MediaInspection, trackId: string, kind: MediaTrackInspection["kind"]): MediaTrackInspection | undefined {
  const resolvedId = resolveMediaTrackId(trackId);
  const matches = inspection.tracks.filter((track) => track.kind === kind && track.id === resolvedId);
  return matches.length === 1 ? matches[0] : undefined;
}

export interface MediaInspectOptions {
  readonly runtime?: import("./runtime.js").Runtime;
  readonly signal?: AbortSignal;
}

export interface MediaTrim {
  readonly startSeconds?: number;
  readonly endSeconds?: number;
}

export interface NormalizedMediaTrim {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

/** Normalize a trim against the inspected source duration. */
export function normalizeTrim(trim: MediaTrim | undefined, durationSeconds: number): NormalizedMediaTrim {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new TypeError("Media duration must be a positive finite number");
  }
  const startSeconds = trim?.startSeconds ?? 0;
  const endSeconds = trim?.endSeconds ?? durationSeconds;
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds <= startSeconds || endSeconds > durationSeconds) {
    throw new TypeError("Media trim must satisfy 0 <= startSeconds < endSeconds <= durationSeconds");
  }
  return Object.freeze({ startSeconds, endSeconds });
}

export interface ConversionTrackSelection {
  readonly sourceId: string;
  readonly trackId: string;
  readonly trim?: MediaTrim;
}

export interface ConversionSource {
  readonly id: string;
  readonly input: MediaInput;
}

export interface ConversionVideoSelection extends ConversionTrackSelection {
  /** Mirror horizontally in addition to the input's existing display transformation. */
  readonly flip?: boolean;
  /** Default true: preserve transforms as metadata where supported. False bakes them into pixels. */
  readonly allowTransformationMetadata?: boolean;
}

/** Opt into packet copying at trim boundaries. Tolerances are in seconds. */
export interface ConversionCopyOptions {
  /** Preferred falls back to transcoding; required rejects if any selected track cannot be copied. */
  readonly mode?: "preferred" | "required";
  /** Expand may retain media outside the trim; shrink may omit media inside it. Default expand.
   * Container timing limitations still apply: neither policy promises frame-exact end boundaries.
   */
  readonly boundaryPolicy?: "expand" | "shrink";
  /** Maximum deviation at the START of the requested trim. Default Infinity. */
  readonly boundaryTolerance?: number;
  /** Only zero is supported: independently selected tracks must never shift out of sync. */
  readonly shiftTolerance?: 0;
}

/** Validate portable copy options before loading media or allocating codecs. */
export function normalizeConversionCopy(copy: ConversionCopyOptions | false | undefined): ConversionCopyOptions | false | undefined {
  if (copy === undefined || copy === false) return copy;
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
    throw new TypeError("Conversion copy must be false or an options object");
  }
  for (const key of Object.keys(copy)) {
    if (!["mode", "boundaryPolicy", "boundaryTolerance", "shiftTolerance"].includes(key)) {
      throw new TypeError(`Unsupported conversion copy option ${JSON.stringify(key)}`);
    }
  }
  if (copy.mode !== undefined && copy.mode !== "preferred" && copy.mode !== "required") {
    throw new TypeError("Conversion copy mode must be preferred or required");
  }
  if (copy.boundaryPolicy !== undefined && copy.boundaryPolicy !== "expand" && copy.boundaryPolicy !== "shrink") {
    throw new TypeError("Conversion copy boundaryPolicy must be expand or shrink");
  }
  if (copy.boundaryTolerance !== undefined && (typeof copy.boundaryTolerance !== "number" || Number.isNaN(copy.boundaryTolerance) || copy.boundaryTolerance < 0)) {
    throw new TypeError("Conversion copy boundaryTolerance must be a non-negative number");
  }
  if (copy.shiftTolerance !== undefined && copy.shiftTolerance !== 0) {
    throw new TypeError("Conversion copy shiftTolerance only supports zero to preserve selected-track synchronization");
  }
  return Object.freeze({ ...copy });
}

export interface ConversionRequest {
  readonly sources: readonly ConversionSource[];
  readonly video: ConversionVideoSelection;
  readonly audio: readonly (ConversionTrackSelection & Readonly<{ id: string }>)[];
  readonly format: Extract<OutputFormat, "mp4" | "webm" | "mov" | "mkv">;
  readonly resize?: Readonly<{ width: number; height: number; fit?: "fill" | "contain" | "cover" }>;
  readonly encoding?: Omit<EncodingOptions, "format">;
  /** Omit for legacy trimming (transcode when the first packet precedes the trim).
   * An object opts into boundary-aware copying; false always transcodes.
   */
  readonly copy?: ConversionCopyOptions | false;
  readonly signal?: AbortSignal;
}

/** Portable, streamable result from host-native conversion. */
export interface ConversionTrackPlan {
  readonly sourceId: string;
  readonly trackId: string;
  readonly action: "copy" | "transcode";
  /** Observed output packet start/end on the output clock. Present after execution, absent at preflight. */
  readonly outputStartSeconds?: number;
  readonly outputEndSeconds?: number;
}

export interface ConversionArtifact extends AsyncDisposable {
  readonly schemaVersion: 0;
  readonly kind: "@foxworth/superimg/conversion-artifact";
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  /** With an explicit copy policy, the observed output end time; otherwise the requested trim span.
   * Negative preroll and late starts are reported separately in each track's output bounds.
   */
  readonly durationSeconds: number;
  /** Per-selected-track conversion decision, separate from authored media identity. */
  readonly tracks: readonly ConversionTrackPlan[];
  /** Open an independent reader. Disposal invalidates all active readers and prevents new ones. */
  open(): ReadableStream<Uint8Array>;
  /** Release owned storage; safe to call repeatedly, independently of runtime disposal. */
  dispose(): Promise<void>;
}
