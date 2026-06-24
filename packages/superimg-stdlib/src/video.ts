/**
 * Frame-accurate embedded video for headless render.
 * Emits marked <video> elements; Playwright seeks before screenshot.
 */

import { css } from "./css.js";

export const VIDEO_SYNC_ATTR = "data-superimg-video";

export interface VideoSyncOptions {
  src: string;
  /** Output timeline position in seconds (default: caller passes sceneTimeSeconds) */
  at?: number;
  /** Offset into source media in seconds */
  start?: number;
  playbackRate?: number;
  width?: number | string;
  height?: number | string;
  objectFit?: "cover" | "contain" | "fill";
  muted?: boolean;
}

export interface VideoSyncResult {
  /** Resolved source media time in seconds (frame-quantized) */
  time: number;
  html: string;
  style: string;
}

export function quantizeVideoTime(time: number, fps: number): number {
  if (fps <= 0) return time;
  const step = 1 / fps;
  return Math.round(time / step) * step;
}

export function sync(options: VideoSyncOptions, fps: number): VideoSyncResult {
  const {
    src,
    at = 0,
    start = 0,
    playbackRate = 1,
    width = "100%",
    height = "100%",
    objectFit = "cover",
    muted = true,
  } = options;

  const time = quantizeVideoTime(start + at * playbackRate, fps);
  const style = css({
    width,
    height,
    objectFit,
    display: "block",
  });

  const html = `<video ${VIDEO_SYNC_ATTR} data-src="${escapeAttr(src)}" data-at="${time}" src="${escapeAttr(src)}" style="${style}" crossorigin="anonymous"${muted ? " muted" : ""} playsinline preload="auto"></video>`;

  return { time, html, style };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}