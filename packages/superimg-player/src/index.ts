//! SuperImg Player - Browser player for rendering and playing templates

// Main Player export
export { Player, resolveFormat } from "./player.js";
export type {
  PlayerOptions,
  PlayerInput,
  PlayerEvents,
  LoadOptions,
  LoadResult,
  FormatOption,
  CaptureOptions,
  CapturedFrame,
} from "./player.js";

// Re-export player components for advanced usage
export { createPlayerStore } from "./state.js";
export type { PlayerStore, PlayerConfig, PlayerStoreCallbacks } from "./state.js";

// Re-export types from @superimg/types
export type { 
  PlaybackMode,
  LoadMode,
  HoverBehavior,
} from "@superimg/types";

// PlayerState is defined in state.ts
export type { PlayerState } from "./state.js";

// Re-export checkpoint types for convenience
export type { Checkpoint, CheckpointSource, Marker, MarkerPosition } from "@superimg/types";

export { createPlaybackController } from "./playback.js";
export type { PlaybackController, PlaybackCallbacks } from "./playback.js";

export { createTimelineController, formatTime, renderCheckpointMarkers } from "./timeline.js";
export type { TimelineController, TimelineElements, CheckpointMarkerOptions } from "./timeline.js";

export { createCheckpointControls } from "./controls.js";
export type { CheckpointControls, CheckpointControlsOptions } from "./controls.js";

export { HtmlPresenter } from "./html-presenter.js";
export { CanvasPresenter } from "./canvas-presenter.js";
