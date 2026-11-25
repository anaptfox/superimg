//! Framework-neutral passive playback surface.
//!
//! This entrypoint intentionally contains no authoring, compiler, React, or
//! export-runtime APIs. Hosts may mount the Player directly or build their own
//! UI around MediaSession and MediaClock.

export * from "@superimg/player";

export {
  createMediaSession,
  MediaClock,
  MediaSession,
} from "@superimg/media";

export type {
  DomMediaSurface,
  ExternalEmbedNode,
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
  RuntimeState,
  RuntimeStore,
  VideoMediaNode,
} from "@superimg/media";
