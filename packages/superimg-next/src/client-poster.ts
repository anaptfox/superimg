import {
  renderPosterMarkup,
  type SerializableMediaPayload,
} from "@superimg/adapters";

/** Client-safe poster HTML from a serializable payload (already on the client). */
export function posterHtmlFromPayload(payload: SerializableMediaPayload): string {
  return renderPosterMarkup(payload.poster);
}
