//! @superimg/next — Next.js App Router integration for SuperImg.
//! Prefer explicit subpaths:
//!   @superimg/next/server  — RSC, Route Handlers, Server Actions
//!   @superimg/next/client  — Client Components (Player island)
//!
//! Root export is RSC-safe (server helpers + types). Client Player is not here.

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
