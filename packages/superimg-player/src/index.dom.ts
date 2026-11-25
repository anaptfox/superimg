//! Passive DOM mounting. Driven playback, navigation and inspection are opt-in.
export { createDomPlayer } from "./dom-player.js";
export type { DomPlayer, DomPlayerEvents, DomPlayerOptions } from "./dom-player.js";
export type {
  LoadOptions, LoadResult, PlayerInput, PlayerUpdate, PlayerEvents,
  PlayerPresentation, PlayerPerformanceSnapshot,
} from "./player-types.js";
export type {
  PreResolvedFonts, RuntimeState, RuntimeStore,
  RuntimePerformanceOptions, RuntimePerformanceRecord, RuntimePerformanceCounters,
  RuntimePerformanceKind, RuntimePerformanceStage,
} from "@superimg/media";
export type { PlaybackMode } from "@superimg/types";

export type { NormalizedCue } from "./player-types.js";
