//! @superimg/tanstack-start — loader / server-fn helpers + Player re-export.

export {
  loaderPayload,
  posterHtml,
  payloadFromMediaIR,
  renderPosterMarkup,
  type LoaderPayloadOptions,
  type MediaPoster,
  type SerializableMediaPayload,
} from "./server.js";

export {
  Player,
  type PlayerProps,
  type PlayerRef,
  type PlayerInput,
  type LoadResult,
} from "@foxworth/superimg/react/player";
