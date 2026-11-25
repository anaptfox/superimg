//! Direct authored media files as ordinary reusable MediaDefinitions.
//!
//! Size, timing and source identity are explicit. Runtime asset preparation
//! snapshots URL bytes for each job; bytes passed here are copied immediately.

import { image, svg, video, type AssetDeclaration, type CanvasSize, type Duration } from "@superimg/types";
import { Html, Vector, h } from "@superimg/stdlib/tree";

export type SourceInput = string | URL | Readonly<{ bytes: Uint8Array; mimeType: string }>;
export type SourceFit = "contain" | "cover" | "fill";

export interface SourceImageOptions {
  readonly src: SourceInput;
  readonly size: CanvasSize;
  readonly fit?: SourceFit;
}

export interface SourceVideoOptions extends SourceImageOptions {
  /** Sampling rate of this authored definition. */
  readonly fps: number;
  /** Visual duration. May be inferred from `trim.to - trim.from`. */
  readonly duration?: Duration;
  /** Seconds or explicit time units in the source file. */
  readonly trim?: Readonly<{ from?: Duration; to?: Duration }>;
}

function assertSize(size: CanvasSize): void {
  if (!size || !Number.isSafeInteger(size.width) || !Number.isSafeInteger(size.height) || size.width <= 0 || size.height <= 0) {
    throw new TypeError("source: size must use positive integer pixels");
  }
}

function assertFit(fit: SourceFit | undefined): void {
  if (fit !== undefined && fit !== "contain" && fit !== "cover" && fit !== "fill") {
    throw new TypeError("source: fit must be contain, cover, or fill");
  }
}

function declaration(src: SourceInput, kind: "image" | "video"): AssetDeclaration {
  if (typeof src === "string" || src instanceof URL) {
    let url: URL;
    try { url = src instanceof URL ? new URL(src.href) : new URL(src); }
    catch { throw new TypeError("source: src must be an absolute file URL or explicit bytes"); }
    if (url.protocol !== "file:") throw new TypeError("source: src must be a file URL or explicit bytes");
    return Object.freeze({ url: url.href, type: kind });
  }
  if (!src || !(src.bytes instanceof Uint8Array) || src.bytes.byteLength === 0 || !src.mimeType?.trim()) {
    throw new TypeError("source: bytes require a non-empty Uint8Array and mimeType");
  }
  const owned = new Uint8Array(src.bytes);
  return Object.freeze({
    get bytes() { return new Uint8Array(owned); },
    mimeType: src.mimeType,
    type: kind,
  });
}

function seconds(value: Duration, fps: number, field: string): number {
  const parsed = typeof value === "number" ? value :
    value.endsWith("ms") ? Number(value.slice(0, -2)) / 1000 :
    value.endsWith("s") ? Number(value.slice(0, -1)) :
    value.endsWith("f") ? Number(value.slice(0, -1)) / fps : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`source: ${field} must be a finite nonnegative duration`);
  return parsed;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** A still image. The bytes are frozen by the export job before rendering. */
function imageSource(options: SourceImageOptions) {
  assertSize(options.size);
  assertFit(options.fit);
  const asset = declaration(options.src, "image");
  return image({
    size: options.size,
    assets: { source: asset },
    render(ctx) {
      return Html({ width: "fill", height: "fill", html: `<img src="${escapeAttr(ctx.asset("source"))}" alt="" style="display:block;width:100%;height:100%;object-fit:${options.fit ?? "contain"}">` });
    },
  });
}

/** An SVG file retained as a vector definition. */
function svgSource(options: SourceImageOptions) {
  assertSize(options.size);
  assertFit(options.fit);
  const asset = declaration(options.src, "image");
  const aspect = options.fit === "fill" ? "none" : options.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
  return svg({
    size: options.size,
    assets: { source: asset },
    render(ctx) {
      return Vector({ width: ctx.width, height: ctx.height, viewBox: { x: 0, y: 0, width: ctx.width, height: ctx.height } },
        h("image", { href: ctx.asset("source"), width: ctx.width, height: ctx.height, preserveAspectRatio: aspect }));
    },
  });
}

/**
 * Video frames sampled from a local MP4/WebM via the headless extractor.
 * This definition is visual-only; the source file's audio is not included.
 */
function videoSource(options: SourceVideoOptions) {
  assertSize(options.size);
  assertFit(options.fit);
  if (!Number.isSafeInteger(options.fps) || options.fps <= 0) throw new TypeError("source.video: fps must be a positive integer");
  const from = options.trim?.from === undefined ? 0 : seconds(options.trim.from, options.fps, "trim.from");
  const to = options.trim?.to === undefined ? undefined : seconds(options.trim.to, options.fps, "trim.to");
  if (to !== undefined && to <= from) throw new TypeError("source.video: trim.to must be after trim.from");
  const durationSeconds = options.duration === undefined ? (to === undefined ? undefined : to - from) : seconds(options.duration, options.fps, "duration");
  if (durationSeconds === undefined || durationSeconds <= 0) throw new TypeError("source.video: provide a positive duration or trim.to");
  if (to !== undefined && Math.abs(durationSeconds - (to - from)) > 1e-9) throw new TypeError("source.video: duration must match trim.to - trim.from");
  const duration: Duration = options.duration ?? `${durationSeconds}s`;
  const asset = declaration(options.src, "video");
  return video({
    size: options.size,
    fps: options.fps,
    duration,
    assets: { source: asset },
    render(ctx) {
      // Embedded clip extraction uses exact frame timestamps. Timeline.seconds
      // is progress-scaled to include the endpoint and can drift by one frame.
      const frame = ctx.std.video.sync({ id: "source", src: ctx.asset("source"), at: ctx.timeline.frame / ctx.fps, start: from, width: "100%", height: "100%", objectFit: options.fit ?? "contain" });
      return Html({ width: "fill", height: "fill", html: frame.html });
    },
  });
}

export const source = Object.freeze({ image: imageSource, svg: svgSource, video: videoSource });
