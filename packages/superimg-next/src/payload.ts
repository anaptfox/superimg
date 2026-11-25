//! RSC-safe payload builders — wrap adapters core; no Player / Playwright.

import type { JsonObject, MediaIR } from "@superimg/types";
import {
  payloadFromMediaIR,
  renderPosterMarkup,
  type MediaPoster,
  type SerializableMediaPayload,
} from "@superimg/adapters";

export type { MediaPoster, SerializableMediaPayload };
export {
  payloadFromMediaIR,
  createMediaPoster,
  renderPosterMarkup,
  assertSerializablePayload,
} from "@superimg/adapters";

export type CreateServerPayloadOptions = {
  data?: JsonObject;
  posterHtml?: string;
  imageUrl?: string;
  alt?: string;
  /** Include full Media IR on the payload (default true). */
  includeMedia?: boolean;
};

/**
 * Build an RSC-safe payload for a Server Component / layout.
 * Do not pass template modules or render functions across this boundary.
 */
export function createServerPayload(
  ir: MediaIR,
  options?: CreateServerPayloadOptions,
): SerializableMediaPayload {
  return payloadFromMediaIR(ir, options);
}

/** SSR poster HTML string for Server Components without a client boundary. */
export function posterHtml(payload: SerializableMediaPayload): string {
  return renderPosterMarkup(payload.poster);
}

/** Pick only RSC-safe fields for Client Component props. */
export function toClientProps(
  payload: SerializableMediaPayload,
): Pick<
  SerializableMediaPayload,
  "schemaVersion" | "sourceId" | "poster" | "media" | "data"
> {
  return {
    schemaVersion: payload.schemaVersion,
    sourceId: payload.sourceId,
    poster: payload.poster,
    ...(payload.media !== undefined ? { media: payload.media } : {}),
    ...(payload.data !== undefined ? { data: payload.data } : {}),
  };
}
