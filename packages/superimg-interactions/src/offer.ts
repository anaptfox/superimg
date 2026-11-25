import { projectMediaInteractions } from "./projection.js";
import type { MediaInteractionExposure } from "./mount.js";

/**
 * Caller Offer for the Media surface reached over the bus / `ops mcp`.
 *
 * Direct: check, inspect, describe, thumbnail, arrange.
 * Request: snapshot, compile, export.
 * Discover stays CLI-local. Nothing delete-shaped exists to offer.
 */
export const MEDIA_OFFER_EXPOSURE = Object.freeze({
  check: "direct",
  inspect: "direct",
  describe: "direct",
  thumbnail: "direct",
  arrange: "direct",
  snapshot: "request",
  compile: "request",
  export: "request",
} as const satisfies MediaInteractionExposure);

export const MEDIA_REACH_DIRECT_EXPOSURE = Object.freeze({
  check: "direct",
  inspect: "direct",
  describe: "direct",
  thumbnail: "direct",
  arrange: "direct",
} as const satisfies MediaInteractionExposure);

export function projectMediaOffer() {
  return projectMediaInteractions(MEDIA_OFFER_EXPOSURE);
}

/** Reach Binding while request-mode Control is not installed on the CLI path. */
export function projectMediaReachSurface() {
  return projectMediaInteractions(MEDIA_REACH_DIRECT_EXPOSURE);
}
