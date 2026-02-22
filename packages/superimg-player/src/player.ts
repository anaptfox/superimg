//! Player - Browser player for SuperImg templates
//! Renders templates to canvas with playback controls, seeking, and caching

import type {
  RenderContext,
  TemplateModule,
  Checkpoint,
  Marker,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
} from "@superimg/types";
import {
  SuperImgError,
} from "@superimg/types";

// =============================================================================
// PLAYER-SPECIFIC TYPES (defined here, exported from this module)
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

/**
 * Result of loading a template into a player
 */
export type LoadResult =
  | {
      status: "success";
      totalFrames: number;
      durationSeconds: number;
      width: number;
      height: number;
      fps: number;
    }
  | {
      status: "error";
      errorType: "compilation" | "validation" | "network";
      message: string;
      suggestion: string;
      details?: Record<string, unknown>;
    };

/** What can be passed to player.load() */
export type PlayerInput = TemplateModule;

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

/**
 * Player not ready error
 */
class PlayerNotReadyError extends SuperImgError {
  constructor(operation: string) {
    super(
      `Player not ready for operation: ${operation}`,
      "PLAYER_NOT_READY",
      { operation },
      `Call load() and wait for it to complete before calling ${operation}().`,
      "https://superimg.dev/docs/player"
    );
    this.name = "PlayerNotReadyError";
  }
}
import { CheckpointResolver, createRenderContext } from "@superimg/core";
import { createPlayerStore, type PlayerStore, type PlayerConfig } from "./state.js";
import { createPlaybackController, type PlaybackController } from "./playback.js";
import { CanvasRenderer } from "@superimg/runtime";

export interface LoadOptions {
  /** Explicit markers for non-scene checkpoints */
  markers?: Marker[];
}

/**
 * Player - Embeddable player for SuperImg templates
 *
 * @example
 * ```typescript
 * import { Player } from 'superimg/browser';
 * import myTemplate from './templates/my-template';
 *
 * const player = new Player({
 *   container: '#player',
 *   width: 1280,
 *   height: 720,
 *   playbackMode: 'loop',
 *   loadMode: 'eager',
 * });
 *
 * const result = await player.load(myTemplate);
 * if (result.status === 'success') {
 *   player.play();
 * }
 * ```
 */
export class Player {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: CanvasRenderer;
  private _store: PlayerStore | null = null;
  private playbackController: PlaybackController | null = null;
  private _checkpointResolver: CheckpointResolver | null = null;
  private template: TemplateModule | null = null;
  private _totalFrames: number = 0;
  private _fps: number = 30;
  private options: Required<Omit<PlayerOptions, "container">>;
  private events: Partial<PlayerEvents> = {};
  private _isReady = false;

  constructor(options: PlayerOptions) {
    // Resolve container
    if (typeof options.container === "string") {
      const el = document.querySelector(options.container);
      if (!el) {
        throw new Error(`Container not found: ${options.container}`);
      }
      this.container = el as HTMLElement;
    } else {
      this.container = options.container;
    }

    // Set defaults with new mode-based options
    this.options = {
      width: options.width ?? 1920,
      height: options.height ?? 1080,
      playbackMode: options.playbackMode ?? "once",
      loadMode: options.loadMode ?? "eager",
      hoverBehavior: options.hoverBehavior ?? "none",
      hoverDelayMs: options.hoverDelayMs ?? 200,
      maxCacheFrames: options.maxCacheFrames ?? 30,
      showControls: options.showControls ?? false,
    };

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.display = "block";
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.height = "auto";
    this.container.appendChild(this.canvas);

    // Create renderer
    this.renderer = new CanvasRenderer(this.canvas);
  }

  /**
   * Load a template module
   *
   * @param input - Template module to load
   * @param loadOptions - Optional load options
   * @returns LoadResult with success/error status
   */
  async load(input: PlayerInput, loadOptions?: LoadOptions): Promise<LoadResult> {
    try {
      // Store template
      this.template = input;

      // Get config from template
      const fps = this.template.config?.fps ?? 30;
      const durationSeconds = this.template.config?.durationSeconds ?? 5;
      const width = this.template.config?.width ?? this.options.width;
      const height = this.template.config?.height ?? this.options.height;

      // Update canvas if template specifies dimensions
      if (this.template.config?.width || this.template.config?.height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      // Calculate total frames directly
      const totalFrames = Math.ceil(durationSeconds * fps);
      this._totalFrames = totalFrames;
      this._fps = fps;

      // Create checkpoint resolver if markers provided
      if (loadOptions?.markers?.length) {
        this._checkpointResolver = new CheckpointResolver(
          loadOptions.markers,
          totalFrames,
          fps
        );
      }

      // Create player store
      const config: PlayerConfig = {
        fps,
        durationSeconds,
      };

      this._store = createPlayerStore(
        config,
        {
          onPlay: () => {
            this.events.play?.();
            if (this.playbackController) {
              this.playbackController.play(this._store!.getState().currentFrame);
            }
          },
          onPause: () => {
            this.events.pause?.();
            this.playbackController?.pause();
          },
          onFrameChange: (frame) => {
            this.renderFrame(frame);
          },
          onCheckpoint: (checkpoint) => {
            this.events.checkpoint?.(checkpoint);
          },
          maxCacheSize: this.options.maxCacheFrames,
        },
        this._checkpointResolver ?? undefined
      );

      // Create playback controller
      this.playbackController = createPlaybackController(this._store, {
        onFrame: (frame) => {
          this._store!.getState().setFrame(frame);
          this.events.frame?.(frame);
        },
        onEnd: () => {
          if (this.options.playbackMode === "loop") {
            this._store!.getState().setFrame(0);
            this._store!.getState().play();
          } else if (this.options.playbackMode === "ping-pong") {
            // TODO: Implement ping-pong
            this._store!.getState().setFrame(0);
            this._store!.getState().play();
          } else {
            this._store!.getState().pause();
            this.events.ended?.();
          }
        },
      });

      // Warmup renderer
      await this.renderer.warmup();

      // Render first frame
      await this.renderFrame(0);

      this._isReady = true;
      this.events.ready?.();

      return {
        status: "success",
        totalFrames,
        durationSeconds,
        width,
        height,
        fps,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.error?.(err);

      return {
        status: "error",
        errorType: "compilation",
        message: err.message,
        suggestion: "Check that the template module exports a valid render function.",
        details: { originalError: err.message },
      };
    }
  }

  /**
   * Render a specific frame
   */
  private async renderFrame(frame: number): Promise<void> {
    if (!this.template || !this._store) {
      return;
    }

    const state = this._store.getState();

    // Check cache
    const cached = state.frameCache.get(frame);
    if (cached) {
      const ctx2d = this.renderer.getCanvas().getContext("2d")!;
      ctx2d.putImageData(cached, 0, 0);
      return;
    }

    // Build context directly
    const ctx = createRenderContext(
      frame,
      this._fps,
      this._totalFrames,
      this.canvas.width,
      this.canvas.height,
      this.template.defaults ?? {}
    );

    // Render
    const imageData = await this.renderer.renderFrame(this.template.render, ctx);

    // Cache with LRU eviction
    const frameCache = state.frameCache;
    if (frameCache.size >= this.options.maxCacheFrames) {
      const firstKey = frameCache.keys().next().value;
      if (firstKey !== undefined) {
        frameCache.delete(firstKey);
      }
    }
    frameCache.set(frame, imageData);
  }

  // ==========================================================================
  // PLAYBACK CONTROLS
  // ==========================================================================

  /**
   * Start playback
   */
  play(): void {
    if (!this._store) {
      throw new PlayerNotReadyError("play");
    }
    this._store.getState().play();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this._store) {
      throw new PlayerNotReadyError("pause");
    }
    this._store.getState().pause();
  }

  /**
   * Stop playback and reset to start
   */
  stop(): void {
    if (!this._store) {
      throw new PlayerNotReadyError("stop");
    }
    this._store.getState().pause();
    this._store.getState().setFrame(0);
  }

  // ==========================================================================
  // SEEKING - Explicit methods for each unit type
  // ==========================================================================

  /**
   * Seek to a specific frame number
   * @param frame - Frame number (0-indexed)
   */
  seekToFrame(frame: number): void {
    if (!this._store) {
      throw new PlayerNotReadyError("seekToFrame");
    }
    const totalFrames = this._store.getState().totalFrames;
    const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));
    this._store.getState().setFrame(Math.floor(clampedFrame));
  }

  /**
   * Seek to a specific progress value
   * @param progressValue - Progress (0-1)
   */
  seekToProgress(progressValue: number): void {
    if (!this._store) {
      throw new PlayerNotReadyError("seekToProgress");
    }
    const clampedProgress = Math.max(0, Math.min(progressValue, 1));
    const totalFrames = this._store.getState().totalFrames;
    const frame = Math.floor(clampedProgress * (totalFrames - 1));
    this._store.getState().setFrame(frame);
  }

  /**
   * Seek to a specific time in seconds
   * @param seconds - Time in seconds
   */
  seekToTimeSeconds(seconds: number): void {
    if (!this._store) {
      throw new PlayerNotReadyError("seekToTimeSeconds");
    }
    const fps = this._store.getState().fps;
    const totalFrames = this._store.getState().totalFrames;
    const frame = Math.floor(seconds * fps);
    const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));
    this._store.getState().setFrame(clampedFrame);
  }

  // ==========================================================================
  // STATE PROPERTIES
  // ==========================================================================

  /** Current frame number (0-indexed) */
  get currentFrame(): number {
    return this._store?.getState().currentFrame ?? 0;
  }

  /** Current time in seconds */
  get currentTimeSeconds(): number {
    if (!this._store) return 0;
    return this._store.getState().currentFrame / this._store.getState().fps;
  }

  /** Current progress (0-1) */
  get currentProgress(): number {
    if (!this._store) return 0;
    const state = this._store.getState();
    return state.currentFrame / Math.max(1, state.totalFrames - 1);
  }

  /** Total frames */
  get totalFrames(): number {
    return this._store?.getState().totalFrames ?? 0;
  }

  /** Total duration in seconds */
  get totalDurationSeconds(): number {
    return this._store?.getState().durationSeconds ?? 0;
  }

  /** Whether currently playing */
  get isPlaying(): boolean {
    return this._store?.getState().isPlaying ?? false;
  }

  /** Whether player is ready (loaded) */
  get isReady(): boolean {
    return this._isReady;
  }

  /** FPS */
  get fps(): number {
    return this._store?.getState().fps ?? 30;
  }

  /** The player store (for advanced usage) */
  get store(): PlayerStore | null {
    return this._store;
  }

  /** The checkpoint resolver (for timeline marker rendering) */
  get checkpointResolver(): CheckpointResolver | null {
    return this._checkpointResolver;
  }

  // ==========================================================================
  // CHECKPOINT NAVIGATION
  // ==========================================================================

  /**
   * Navigate to a checkpoint by ID
   */
  goToCheckpoint(id: string): void {
    if (!this._store) {
      throw new PlayerNotReadyError("goToCheckpoint");
    }
    this._store.getState().goToCheckpoint?.(id);
  }

  /**
   * Navigate to the next checkpoint
   */
  nextCheckpoint(): void {
    if (!this._store) {
      throw new PlayerNotReadyError("nextCheckpoint");
    }
    this._store.getState().goToNextCheckpoint?.();
  }

  /**
   * Navigate to the previous checkpoint
   */
  prevCheckpoint(): void {
    if (!this._store) {
      throw new PlayerNotReadyError("prevCheckpoint");
    }
    this._store.getState().goToPreviousCheckpoint?.();
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return this._checkpointResolver?.getAll() ?? [];
  }

  /**
   * Get the current checkpoint (at or before current frame)
   */
  getCurrentCheckpoint(): Checkpoint | undefined {
    return this._store?.getState().getCurrentCheckpoint?.();
  }

  /**
   * Add a checkpoint at runtime
   */
  addCheckpoint(
    id: string,
    frame?: number,
    options?: { label?: string; metadata?: Record<string, unknown> }
  ): Checkpoint | undefined {
    if (!this._checkpointResolver) return undefined;
    const targetFrame = frame ?? this.currentFrame;
    return this._checkpointResolver.add(id, targetFrame, options);
  }

  /**
   * Remove a runtime checkpoint
   */
  removeCheckpoint(id: string): boolean {
    return this._checkpointResolver?.remove(id) ?? false;
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Register event listener
   */
  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.events[event] = callback as PlayerEvents[K];
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PlayerEvents>(event: K): void {
    delete this.events[event];
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Destroy player and clean up resources
   */
  destroy(): void {
    this.playbackController?.destroy();
    this.playbackController = null;
    this._store = null;
    this._checkpointResolver = null;
    this.template = null;
    this.canvas.remove();
    this.events = {};
    this._isReady = false;
  }
}
