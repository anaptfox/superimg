//! SuperImg - Browser-specific exports
//! Browser playback and media-session exports.

export * from "./index.shared.js";

// =============================================================================
// PLAYER (main browser export)
// =============================================================================

export { Player, resolveFormat } from "@superimg/player";

// =============================================================================
// MEDIA SESSION RUNTIME
// =============================================================================

export { createMediaSession, MediaClock, MediaSession } from "@superimg/media";

// =============================================================================
// PLAYER UTILITIES
// =============================================================================

export {
  formatTime,
} from "@superimg/player";

export type { RuntimeState, RuntimeStore } from "@superimg/media";

// Media types
export type {
  DomMediaSurface,
  ExternalEmbedNode,
  FormatOption as MediaFormatOption,
  MediaClockOptions,
  MediaClockState,
  MediaFrameResult,
  MediaGraph,
  MediaGraphNode,
  MediaPlaybackMode,
  MediaSessionEvents,
  MediaSessionOptions,
  MediaSessionPlayback,
  MediaSessionState,
  MediaSessionUpdate,
  MediaSurface,
  MediaSurfaceKind,
  MediaSurfaceMountOptions,
  VideoMediaNode,
} from "@superimg/media";

// Player types
export type {
  LoadOptions,
  FormatOption,
  PlayerOptions,
  PlayerEvents,
  PlayerInput,
  PlayerUpdate,
  LoadResult,
} from "@superimg/player";
