//! SuperImg Player - high-level browser playback/controller layer

export { Player, resolveFormat } from "./player.js";
export type {
  PlayerOptions,
  PlayerInput,
  PlayerEvents,
  LoadOptions,
  LoadResult,
  FormatOption,
  PlayerUpdate,
} from "./player.js";
export type { PreResolvedFonts } from "@superimg/media";

export type {
  PlaybackMode,
  LoadMode,
  HoverBehavior,
} from "@superimg/types";

export type { Checkpoint, CheckpointSource, Marker, MarkerPosition } from "@superimg/types";

export { formatTime, renderCheckpointMarkers, createTimelineController } from "./timeline.js";
export type { CheckpointMarkerOptions } from "./timeline.js";

export { createPlayerStore } from "./state.js";
export type { PlayerStore, PlayerState, PlayerConfig } from "./state.js";

export { createPlaybackController } from "./playback.js";
export type { PlaybackController, PlaybackCallbacks } from "./playback.js";

export { createCheckpointControls } from "./controls.js";
export type { CheckpointControls, CheckpointControlsOptions } from "./controls.js";
