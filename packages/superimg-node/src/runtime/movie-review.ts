//! Decode verified movie bytes once in presentation order. Never evaluates source.
import { createHash } from "node:crypto";
import { ensureServerCodecs } from "./media.js";

export interface MovieReviewClock {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly totalFrames: number;
}

export interface DecodedMovieFrame {
  readonly frame: number;
  readonly timestamp: number;
  readonly duration: number;
  readonly png: Uint8Array;
}

function reject(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

/** Check all knowable work before export; encoded byte/codec facts are checked later. */
export function assertMovieReviewSelection(clock: MovieReviewClock, frames: readonly number[]): void {
  if (clock.width * clock.height > 4096 * 4096 ||
      ![clock.width, clock.height, clock.totalFrames].every(n => Number.isSafeInteger(n) && n > 0) ||
      !Number.isFinite(clock.fps) || clock.fps <= 0 || clock.fps > 120 || clock.totalFrames > 72_000 || clock.totalFrames / clock.fps > 600 || clock.width * clock.height * clock.totalFrames > 16_000_000_000 || frames.length > 512) {
    reject("REVIEW_DECODE_LIMIT", "Movie review exceeds its byte, canvas, 120fps, 10-minute, frame or evidence limits");
  }
  const wanted = new Set(frames);
  if ([...wanted].some(frame => !Number.isSafeInteger(frame) || frame < 0 || frame >= clock.totalFrames)) reject("REVIEW_FRAME_INVALID", "Review frame is outside the retained export clock");
}

/** Limits bound full sequential decoding independently of the requested evidence. */
export async function* decodeNodeMovieFrames(input: {
  bytes: Uint8Array;
  sha256: string;
  byteLength: number;
  clock: MovieReviewClock;
  frames: readonly number[];
  signal?: AbortSignal;
}): AsyncGenerator<DecodedMovieFrame> {
  const { clock, signal } = input;
  signal?.throwIfAborted();
  assertMovieReviewSelection(clock, input.frames);
  if (input.bytes.byteLength > 512 * 1024 * 1024) reject("REVIEW_DECODE_LIMIT", "Movie review is limited to 512 MiB");
  const wanted = new Set(input.frames);
  // Own bytes before any asynchronous work; caller mutation cannot change the subject.
  const bytes = input.bytes.slice();
  if (bytes.byteLength !== input.byteLength || createHash("sha256").update(bytes).digest("hex") !== input.sha256) reject("REVIEW_MOVIE_STALE", "Published movie bytes do not match the export receipt");
  await ensureServerCodecs();
  const media = await import("mediabunny");
  const movie = new media.Input({ source: new media.BufferSource(bytes), formats: media.ALL_FORMATS });
  try {
    const track = await movie.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) reject("REVIEW_DECODER_UNAVAILABLE", "No native decoder is available for this movie");
    const width = await track.getCodedWidth(), height = await track.getCodedHeight();
    if (width !== clock.width || height !== clock.height || await track.getDisplayWidth() !== width || await track.getDisplayHeight() !== height || await track.getRotation() !== 0 || await track.getFlip()) {
      reject("REVIEW_GEOMETRY_UNSUPPORTED", "Movie display/coded geometry or transform does not match the retained export canvas");
    }
    const resolution = await track.getTimeResolution();
    // Compare against the container's quantized CFR grid. A timescale equal
    // to fps is exact (one tick/frame), not a half-frame uncertainty interval.
    if (!Number.isFinite(resolution) || resolution < clock.fps) reject("REVIEW_CLOCK_UNSUPPORTED", "Movie time resolution cannot distinguish the retained frame clock");
    const tolerance = 0.000002; // native decoder microsecond rounding only
    const expectedDuration = Math.round(resolution / clock.fps) / resolution;
    const sharp = (await import("sharp")).default;
    let frame = 0, previous = -Infinity, retainedBytes = 0;
    for await (const sample of new media.VideoSampleSink(track).samples()) {
      try {
        signal?.throwIfAborted();
        if (frame >= clock.totalFrames || sample.timestamp <= previous || Math.abs(sample.timestamp - Math.round(frame * resolution / clock.fps) / resolution) > tolerance || Math.abs(sample.duration - expectedDuration) > tolerance) {
          reject("REVIEW_CLOCK_MISMATCH", `Decoded frame ${frame}: timestamp ${sample.timestamp}, duration ${sample.duration}; expected timestamp ${frame / clock.fps}, duration ${1 / clock.fps} (${clock.totalFrames} frames)`);
        }
        if (sample.codedWidth !== width || sample.codedHeight !== height || sample.displayWidth !== width || sample.displayHeight !== height || sample.rotation !== 0) reject("REVIEW_GEOMETRY_UNSUPPORTED", "Decoded frame geometry changed within the movie");
        previous = sample.timestamp;
        if (wanted.has(frame)) {
          const layout = [{ offset: 0, stride: width * 4 }];
          const options = { format: "RGBA" as const, layout };
          const rgba = new Uint8Array(sample.allocationSize(options));
          const copied = await sample.copyTo(rgba, options);
          if (copied.length !== 1 || copied[0]!.offset !== 0 || copied[0]!.stride !== width * 4 || rgba.byteLength !== width * height * 4) reject("REVIEW_PIXELS_UNSUPPORTED", "Decoder did not return the requested packed RGBA layout");
          const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
          retainedBytes += png.byteLength;
          if (retainedBytes > 128 * 1024 * 1024) reject("REVIEW_DECODE_LIMIT", "Decoded review PNGs exceed 128 MiB");
          yield { frame, timestamp: sample.timestamp, duration: sample.duration, png };
        }
        signal?.throwIfAborted();
        frame++;
      } finally { sample.close(); }
    }
    signal?.throwIfAborted();
    if (frame !== clock.totalFrames) reject("REVIEW_CLOCK_MISMATCH", `Expected ${clock.totalFrames} decoded frames, received ${frame}`);
  } finally { movie.dispose(); }
}
