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

/** Serializable loader / server-function return value. */
export function loaderPayload(
  ir: MediaIR,
  options?: LoaderPayloadOptions,
): SerializableMediaPayload {
  return payloadFromMediaIR(ir, options);
}

export function posterHtml(payload: SerializableMediaPayload): string {
  return renderPosterMarkup(payload.poster);
}
