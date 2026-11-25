//! @superimg/next/server — Server Components, Route Handlers, Server Actions only.
//! Never import this entry from a Client Component.

export {
  createServerPayload,
  posterHtml,
  toClientProps,
  payloadFromMediaIR,
  createMediaPoster,
  renderPosterMarkup,
  assertSerializablePayload,
  type CreateServerPayloadOptions,
  type MediaPoster,
  type SerializableMediaPayload,
} from "./payload.js";

export {
  NEXT_CLIENT_FORBIDDEN,
  RSC_SAFE_PROP_KEYS,
} from "./boundaries.js";
