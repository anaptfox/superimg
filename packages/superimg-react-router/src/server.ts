//! Loader / action helpers — serializable data only.

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
  renderPosterMarkup,
};

export type LoaderPayloadOptions = {
  data?: JsonObject;
  posterHtml?: string;
  imageUrl?: string;
  alt?: string;
  includeMedia?: boolean;
};

/** Build loader data — JSON-serializable for React Router. */
export function loaderPayload(
  ir: MediaIR,
  options?: LoaderPayloadOptions,
): SerializableMediaPayload {
  return payloadFromMediaIR(ir, options);
}

/** SSR poster HTML from loader data. */
export function posterFromLoader(payload: SerializableMediaPayload): string {
  return renderPosterMarkup(payload.poster);
}
