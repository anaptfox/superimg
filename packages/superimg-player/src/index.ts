//! SuperImg Player - high-level browser playback/controller layer

export { Player } from "./player.js";
export type {
  PlayerOptions,
  PlayerInput,
  PlayerEvents,
  PlayerPresentation,
  PlayerPerformanceSnapshot,
  LoadOptions,
  LoadResult,
  PlayerUpdate,
} from "./player.js";
export type { PreResolvedFonts } from "@superimg/media";
export type { RuntimeState, RuntimeStore } from "@superimg/media";
export type { RuntimePerformanceOptions, RuntimePerformanceRecord, RuntimePerformanceCounters,
  RuntimePerformanceKind, RuntimePerformanceStage } from "@superimg/media";

/** Framework-neutral DOM mount (vanilla / islands — no React). */
export { createDomPlayer } from "./dom-player.js";
export type {
  DomPlayer,
  DomPlayerEvents,
  DomPlayerOptions,
} from "./dom-player.js";

export type {
  PlaybackMode,
  HoverBehavior,
  DriveSource,
} from "@superimg/types";

export type { Checkpoint, CheckpointSource, Marker, MarkerPosition } from "@superimg/types";

export { formatTime } from "./format-time.js";

export type { NormalizedCue } from "./player-types.js";
