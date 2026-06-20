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

export type {
  PlaybackMode,
  LoadMode,
  HoverBehavior,
} from "@superimg/types";

export type { Checkpoint, CheckpointSource, Marker, MarkerPosition } from "@superimg/types";

export { formatTime, renderCheckpointMarkers, createTimelineController } from "./timeline.js";
export type { CheckpointMarkerOptions } from "./timeline.js";
