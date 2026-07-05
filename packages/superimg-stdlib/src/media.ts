import { css } from "./css.js";
import { CLIP_SYNC_ATTR, quantizeVideoTime } from "./video.js";

export const MEDIA_ATTR = "data-superimg-media";
export const EXTERNAL_EMBED_ATTR = "data-superimg-external-embed";

export type MediaFit = "cover" | "contain" | "fill";

export interface MediaVideoOptions {
  src: string;
  /** Output timeline position in seconds. */
  at?: number;
  /** Offset into source media in seconds. */
  start?: number;
  playbackRate?: number;
  width?: number | string;
  height?: number | string;
  fit?: MediaFit;
  objectFit?: MediaFit;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  poster?: string;
}

export interface MediaYoutubeOptions {
  url?: string;
  videoId?: string;
  /** Output timeline position in seconds. */
  at?: number;
  /** Offset into the YouTube video in seconds. */
  start?: number;
  width?: number | string;
  height?: number | string;
  fit?: MediaFit;
  title?: string;
  poster?: string;
}

export interface MediaVideoResult {
  kind: "video";
  time: number;
  frameIndex: number;
  html: string;
  style: string;
}

export interface MediaYoutubeResult {
  kind: "youtube";
  videoId: string;
  time: number;
  frameIndex: number;
  embedUrl: string;
  html: string;
  style: string;
}

export function video(options: MediaVideoOptions, fps: number): MediaVideoResult {
  const {
    src,
    at = 0,
    start = 0,
    playbackRate = 1,
    width = "100%",
    height = "100%",
    muted = true,
    loop = false,
    controls = false,
    poster,
  } = options;
  const objectFit = options.objectFit ?? options.fit ?? "cover";
  const time = quantizeVideoTime(start + at * playbackRate, fps);
  const frameIndex = Math.round(time * fps);
  const style = css({ width, height, objectFit, display: "block" });

  const attrs = [
    MEDIA_ATTR,
    `${CLIP_SYNC_ATTR}`,
    `data-kind="video"`,
    `data-src="${escapeAttr(src)}"`,
    `data-t="${time}"`,
    `data-frame="${frameIndex}"`,
    `data-playback-rate="${playbackRate}"`,
    `src="${escapeAttr(src)}"`,
    `preload="metadata"`,
    `playsinline`,
    muted ? "muted" : "",
    loop ? "loop" : "",
    controls ? "controls" : "",
    poster ? `poster="${escapeAttr(poster)}"` : "",
    `style="${style}"`,
  ].filter(Boolean);

  return {
    kind: "video",
    time,
    frameIndex,
    html: `<video ${attrs.join(" ")}></video>`,
    style,
  };
}

export function youtube(options: MediaYoutubeOptions, fps: number): MediaYoutubeResult {
  const videoId = options.videoId ?? extractYoutubeId(options.url ?? "");
  if (!videoId) {
    throw new Error("std.media.youtube() requires a YouTube url or videoId");
  }

  const at = options.at ?? 0;
  const start = options.start ?? 0;
  const time = quantizeVideoTime(start + at, fps);
  const frameIndex = Math.round(time * fps);
  const width = options.width ?? "100%";
  const height = options.height ?? "100%";
  const objectFit = options.fit ?? "cover";
  const style = css({
    width,
    height,
    objectFit,
    display: "block",
    border: 0,
  });
  const title = options.title ?? "YouTube video";
  const embedUrl = buildYoutubeEmbedUrl(videoId, Math.max(0, Math.floor(time)));
  const sourceUrl = options.url ?? `https://www.youtube.com/watch?v=${videoId}`;

  const attrs = [
    MEDIA_ATTR,
    EXTERNAL_EMBED_ATTR,
    `data-kind="youtube"`,
    `data-provider="youtube"`,
    `data-video-id="${escapeAttr(videoId)}"`,
    `data-src="${escapeAttr(sourceUrl)}"`,
    `data-t="${time}"`,
    `data-frame="${frameIndex}"`,
    options.poster ? `data-poster="${escapeAttr(options.poster)}"` : "",
    `src="${escapeAttr(embedUrl)}"`,
    `title="${escapeAttr(title)}"`,
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`,
    `allowfullscreen`,
    `style="${style}"`,
  ].filter(Boolean);

  return {
    kind: "youtube",
    videoId,
    time,
    frameIndex,
    embedUrl,
    html: `<iframe ${attrs.join(" ")}></iframe>`,
    style,
  };
}

export function extractYoutubeId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts");
      const id = embedIndex >= 0 ? parts[embedIndex + 1] : undefined;
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

function buildYoutubeEmbedUrl(videoId: string, start: number): string {
  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.searchParams.set("start", String(start));
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("mute", "1");
  return url.toString();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
