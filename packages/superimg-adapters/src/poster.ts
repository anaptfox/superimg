//! SSR-safe poster + stage helpers — no Player, Playwright, FFmpeg, or Node renderers.
//! @experimental Draft

import type { MediaIR } from "@superimg/types";
import {
  payloadFromMediaIR,
  type MediaPoster,
  type SerializableMediaPayload,
} from "./payload.js";
import {
  createSkeletonMarkup,
  createSkeletonPoster,
  renderMediaStage,
  type MediaSkeletonOptions,
} from "./stage.js";

export type { MediaPoster, SerializableMediaPayload };
export type {
  MediaSkeletonOptions,
  MediaSize,
  MediaStageOptions,
  MediaSkeletonVariant,
} from "./stage.js";
export {
  payloadFromMediaIR,
  assertSerializablePayload,
} from "./payload.js";
export {
  createSkeletonMarkup,
  createSkeletonPoster,
  mediaAspectRatio,
  mediaStageStyle,
  mediaStageStyleAttr,
  renderMediaStage,
  renderSkeletonStage,
  SUPERIMG_SKELETON_CSS,
} from "./stage.js";

/**
 * Build a fixed-dimension poster from Media IR for SSR shells.
 * Framework adapters render this string/HTML before hydrating Player client-side.
 */
export function createMediaPoster(
  ir: MediaIR,
  options?: { alt?: string; html?: string; imageUrl?: string },
): MediaPoster {
  return payloadFromMediaIR(ir, {
    ...(options?.html !== undefined ? { posterHtml: options.html } : {}),
    ...(options?.imageUrl !== undefined ? { imageUrl: options.imageUrl } : {}),
    ...(options?.alt !== undefined ? { alt: options.alt } : {}),
    includeMedia: false,
  }).poster;
}

/**
 * Skeleton poster from Media IR canvas size — use when you have no still yet.
 */
export function createSkeletonPosterFromIR(
  ir: MediaIR,
  options?: Omit<MediaSkeletonOptions, "width" | "height">,
): MediaPoster {
  return createSkeletonPoster(
    { width: ir.canvas.width, height: ir.canvas.height },
    { alt: ir.identity.sourceId, ...options },
  );
}

/**
 * Poster / image markup for SSR. Prefer wrapping with {@link renderMediaStage}
 * or {@link renderPosterStage} so the slot keeps the correct aspect ratio
 * before Player hydrates.
 */
export function renderPosterMarkup(poster: MediaPoster): string {
  if (poster.imageUrl) {
    const alt = escapeAttr(poster.alt ?? "media poster");
    // Fluid fill inside a ratio stage (width/height attrs keep intrinsic ratio for CLS).
    return (
      `<img data-superimg-poster="1" src="${escapeAttr(poster.imageUrl)}" ` +
      `width="${poster.width}" height="${poster.height}" alt="${alt}" ` +
      `style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block" />`
    );
  }
  return poster.html;
}

/**
 * Full SSR shell: aspect-ratio stage + poster (or skeleton if `skeleton: true`).
 */
export function renderPosterStage(
  poster: MediaPoster,
  options?: {
    sourceId?: string;
    className?: string;
    /** Use shimmer skeleton instead of poster.html / imageUrl. */
    skeleton?: boolean;
    skeletonLabel?: string;
  },
): string {
  const content = options?.skeleton
    ? createSkeletonMarkup({
        width: poster.width,
        height: poster.height,
        alt: poster.alt ?? options.skeletonLabel ?? "Loading media",
      })
    : renderPosterMarkup(poster);

  return renderMediaStage({
    width: poster.width,
    height: poster.height,
    content,
    ...(options?.sourceId !== undefined ? { sourceId: options.sourceId } : {}),
    ...(options?.className !== undefined ? { className: options.className } : {}),
    ...(poster.alt !== undefined ? { label: poster.alt } : {}),
  });
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
