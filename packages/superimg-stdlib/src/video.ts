/**
 * Frame-accurate embedded video for headless render.
 * Emits marked <img> placeholders; Playwright injects ffmpeg-extracted frames.
 */

import { css } from "./css.js";

export const CLIP_SYNC_ATTR = "data-superimg-clip";

export interface ClipSyncOptions {
  src: string;
  /** Output timeline position in seconds (default: caller passes timeline.seconds) */
  at?: number;
  /** Offset into source media in seconds */
  start?: number;
  playbackRate?: number;
  width?: number | string;
  height?: number | string;
  objectFit?: "cover" | "contain" | "fill";
}

export interface ClipSyncResult {
  /** Resolved source media time in seconds (frame-quantized) */
  time: number;
  /** Frame index at output fps (cache key) */
  frameIndex: number;
  html: string;
  style: string;
}

export function quantizeVideoTime(time: number, fps: number): number {
  if (fps <= 0) return time;
  const step = 1 / fps;
  return Math.round(time / step) * step;
}

export function sync(options: ClipSyncOptions, fps: number): ClipSyncResult {
  const {
    src,
    at = 0,
    start = 0,
    playbackRate = 1,
    width = "100%",
    height = "100%",
    objectFit = "cover",
  } = options;

  const time = quantizeVideoTime(start + at * playbackRate, fps);
  const frameIndex = Math.round(time * fps);
  const style = css({
    width,
    height,
    objectFit,
    display: "block",
  });

  const html = `<img ${CLIP_SYNC_ATTR} data-src="${escapeAttr(src)}" data-t="${time}" data-frame="${frameIndex}" style="${style}" alt="">`;

  return { time, frameIndex, html, style };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}