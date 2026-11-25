//! Player public types + readiness validation.

import type { NormalizedCue } from "@superimg/core/player-core";
import type {
  MediaFrameResult,
  PreResolvedFonts,
  RuntimeRenderedPayload,
  RuntimePresentation,
  RuntimePerformanceOptions,
  RuntimePerformanceSnapshot,
} from "@superimg/media";
import {
  SuperImgError,
  type AssetMeta,
  type CanvasSize,
  type Checkpoint,
  type DriveSource,
  type HoverBehavior,
  type Marker,
  type MediaDefinition,
  type MediaIR,
  type PlaybackMode,
  type ResolveBreakdown,
  type ResolveCueFinding,
  type TemplateConfig,
} from "@superimg/types";

export interface PlayerOptions {
  /** Container element or CSS selector */
  container: string | HTMLElement;
  /** Optional preview canvas override. Authored size is used when omitted. */
  size?: CanvasSize;
  /** Playback mode when video ends (default: "once") */
  playbackMode?: PlaybackMode;
  /** Behavior on hover (default: "none") */
  hoverBehavior?: HoverBehavior;
  /** Scroll or pointer seeks the timeline. Springs are fixed. */
  drive?: DriveSource;
  /** Delay before hover playback triggers, in milliseconds (default: 200) */
  hoverDelayMs?: number;
  /**
   * On pointer leave while hover-playing (default: `"pause"`).
   * `"pause"` keeps the current frame (readable rest). `"reset"` seeks to frame 0
   * (often an empty intro — avoid unless you intentionally want that).
   */
  hoverLeaveBehavior?: "pause" | "reset";
  /**
   * Media composite policy: `"render-only"` (prod default) | `"dev"` (playground / islands).
   * @see @superimg/media player policy
   */
  playerMode?: "render-only" | "dev";
  /**
   * Enable WebAudio timeline playback when the media declares `config.audio`.
   * Defaults to `true` (gracefully silent when WebAudio is unavailable).
   */
  audio?: boolean;
  /** Start muted when audio playback is enabled (default: `false`). */
  muted?: boolean;
  /** Initial audio volume 0..1 (default: `1`). */
  volume?: number;
}

export interface LoadOptions {
  /** Opt-in bounded numeric diagnostics. Read through getPerformance(); no per-frame callback. */
  performance?: RuntimePerformanceOptions;
  /** Runtime data merged over template defaults */
  data?: Record<string, unknown>;
  /** Explicit markers for checkpoint navigation */
  markers?: Marker[];
  /** Runtime asset metadata */
  assets?: Record<string, AssetMeta>;
  /** Resolve co-located asset filenames to URLs */
  assetResolver?: (filename: string) => string;
  /** Host-resolved fonts; suppresses Google Fonts resolution of `config.fonts` */
  fonts?: PreResolvedFonts;
  /** Override constructor playerMode for this load */
  playerMode?: "render-only" | "dev";
  /**
   * Explicit clock/canvas overrides applied after resolve().
   */
  overrides?: Partial<Pick<TemplateConfig, "duration" | "width" | "height" | "fps">>;
  /**
   * Optional MediaIR for timeline UI / validation.
   * Canvas and clock must match the resolved template or load fails.
   */
  mediaIR?: MediaIR;
}

export type LoadResult =
  | {
      status: "success";
      /** Resolved when loaded; reload to recompute data-dependent cues. */
      cues: readonly NormalizedCue[];
      totalFrames: number;
      duration: number;
      width: number;
      height: number;
      fps: number;
      cueFindings?: readonly ResolveCueFinding[];
      breakdown?: ResolveBreakdown;
    }
  | {
      status: "error";
      errorType: "compilation" | "validation" | "network";
      message: string;
      suggestion: string;
      details?: Record<string, unknown>;
    };

/**
 * Player inputs retain the definition's own data/context generic. `any` is
 * intentional here: a host may load any valid media program without erasing
 * its contravariant render and resolve callbacks to `unknown`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlayerInput = MediaDefinition<any>;

export interface PlayerUpdate {
  data?: Record<string, unknown>;
  size?: CanvasSize;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
}

export interface PlayerEvents {
  frame: (frame: number, totalFrames: number) => void;
  rendered: (payload: RuntimeRenderedPayload) => void;
  presentation: (presentation: PlayerPresentation) => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  ready: () => void;
  error: (error: Error) => void;
  checkpoint: (checkpoint: Checkpoint) => void;
}

/** Mounted session identity plus the request/acceptance state within that session. */
export interface PlayerPresentation extends RuntimePresentation {
  readonly generation: number;
}

export interface PlayerPerformanceSnapshot extends RuntimePerformanceSnapshot {
  readonly generation: number;
}

/** An awaited request must not report success when another request replaced it. */
export function assertAcceptedSeek(result: MediaFrameResult, requestedFrame?: number): void {
  if (!result.stale) return;
  throw new SuperImgError(
    "Presentation was superseded by a newer request.",
    "PLAYER_PRESENTATION_SUPERSEDED",
    { ...(requestedFrame !== undefined ? { requestedFrame } : {}), acceptedFrame: result.frame, revision: result.revision },
    "Use the accepted presentation from the most recent request.",
  );
}

export class PlayerNotReadyError extends SuperImgError {
  constructor(operation: string) {
    super(
      `Player not ready for operation: ${operation}`,
      "PLAYER_NOT_READY",
      { operation },
      `Call load() and wait for it to complete before calling ${operation}().`,
      "https://superimg.dev/docs/player",
    );
    this.name = "PlayerNotReadyError";
  }
}

export function toRenderedPayload(result: MediaFrameResult): RuntimeRenderedPayload {
  return {
    frame: result.frame,
    html: result.html,
    compositeHtml: result.compositeHtml,
  };
}

export function assertMediaIRMatchesRuntime(
  ir: MediaIR,
  runtime: { width: number; height: number; fps: number; totalFrames: number },
  message: string,
): void {
  if (
    ir.canvas.width !== runtime.width ||
    ir.canvas.height !== runtime.height ||
    ir.clock.fps !== runtime.fps ||
    ir.clock.totalFrames !== runtime.totalFrames
  ) {
    throw new SuperImgError(
      message,
      "IR_CLOCK_MISMATCH",
      {
        ir: { canvas: ir.canvas, clock: ir.clock },
        runtime,
      },
      "Recompile Media IR for the same template config/data/preset before loading.",
    );
  }
}

export type { NormalizedCue } from "@superimg/core/player-core";
