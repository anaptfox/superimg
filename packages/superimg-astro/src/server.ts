import type { JsonObject, MediaIR } from "@superimg/types";
import {
  payloadFromMediaIR,
  renderPosterMarkup,
  renderPosterStage,
  renderSkeletonStage,
  createSkeletonMarkup,
  mediaAspectRatio,
  mediaStageStyle,
  mediaStageStyleAttr,
  type MediaPoster,
  type SerializableMediaPayload,
} from "@superimg/adapters";

export type { MediaPoster, SerializableMediaPayload };
export {
  payloadFromMediaIR,
  renderPosterMarkup,
  renderPosterStage,
  renderSkeletonStage,
  createSkeletonMarkup,
  mediaAspectRatio,
  mediaStageStyle,
  mediaStageStyleAttr,
};

export type ShellPayloadOptions = {
  data?: JsonObject;
  posterHtml?: string;
  imageUrl?: string;
  alt?: string;
  includeMedia?: boolean;
};

/** Frontmatter / server: serializable payload for the page shell. */
export function buildShellPayload(
  ir: MediaIR,
  options?: ShellPayloadOptions,
): SerializableMediaPayload {
  return payloadFromMediaIR(ir, options);
}

/**
 * HTML fragment for Astro shell (SSR, no Player).
 * Wraps poster in a ratio-correct `data-superimg-stage` so the slot is filled
 * before any client island hydrates.
 */
export function posterFragment(
  payload: SerializableMediaPayload,
  options?: { skeleton?: boolean; className?: string },
): string {
  return renderPosterStage(payload.poster, {
    sourceId: payload.sourceId,
    ...(options?.className !== undefined ? { className: options.className } : {}),
    ...(options?.skeleton !== undefined ? { skeleton: options.skeleton } : {}),
  });
}

/**
 * Shimmer skeleton at the payload canvas aspect ratio — use under
 * `client:only` islands so HTML is never an empty box on first paint.
 */
export function skeletonFragment(
  payload: Pick<SerializableMediaPayload, "poster" | "sourceId">,
  options?: { className?: string; alt?: string },
): string {
  return renderSkeletonStage({
    width: payload.poster.width,
    height: payload.poster.height,
    sourceId: payload.sourceId,
    ...(options?.className !== undefined ? { className: options.className } : {}),
    alt: options?.alt ?? payload.poster.alt ?? payload.sourceId,
  });
}

/** Serializable props for a client island — never includes template modules. */
export function islandProps(payload: SerializableMediaPayload) {
  return {
    schemaVersion: payload.schemaVersion,
    sourceId: payload.sourceId,
    poster: payload.poster,
    media: payload.media,
    data: payload.data,
  };
}
