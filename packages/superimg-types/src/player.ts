//! Player types - User-facing options, events, and input types for the browser player
//! Implementation types (PlayerState, PlayerStore, etc.) live in @superimg/player

import type { Checkpoint } from "./checkpoint.js";
import type { TemplateModule, PlaybackMode, LoadMode, HoverBehavior } from "./types.js";

// =============================================================================
// PLAYER OPTIONS - User-facing configuration
// =============================================================================

/**
 * Options for creating a Player instance
 */
export interface PlayerOptions {
  /** Container element or CSS selector */
  container: string | HTMLElement;
  /** Canvas width in pixels (optional, can be inferred from template) */
  width?: number;
  /** Canvas height in pixels (optional, can be inferred from template) */
  height?: number;
  /** Playback mode when video ends (default: 'once') */
  playbackMode?: PlaybackMode;
  /** When to load/compile the template (default: 'eager') */
  loadMode?: LoadMode;
  /** Behavior on hover (default: 'none') */
  hoverBehavior?: HoverBehavior;
  /** Delay before hover behavior triggers, in milliseconds (default: 200) */
  hoverDelayMs?: number;
  /** Maximum frames to cache (default: 30) */
  maxCacheFrames?: number;
  /** Show built-in controls (default: false) */
  showControls?: boolean;
}

// =============================================================================
// PLAYER EVENTS
// =============================================================================

export interface PlayerEvents {
  /** Fired on each frame render */
  frame: (frame: number) => void;
  /** Fired when playback starts */
  play: () => void;
  /** Fired when playback pauses */
  pause: () => void;
  /** Fired when playback reaches the end */
  ended: () => void;
  /** Fired when player is ready (loaded) */
  ready: () => void;
  /** Fired on error */
  error: (error: Error) => void;
  /** Fired when passing a checkpoint */
  checkpoint: (checkpoint: Checkpoint) => void;
}

// =============================================================================
// PLAYER INPUT
// =============================================================================

/** What can be passed to player.load() */
export type PlayerInput = TemplateModule;
