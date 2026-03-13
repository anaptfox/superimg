//! Player - Browser player for SuperImg templates
//! Renders templates to canvas with playback controls, seeking, and caching

import type {
  RenderContext,
  TemplateModule,
  ComposedTemplate,
  ResolvedScene,
  Checkpoint,
  Marker,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FramePresenter,
  AssetMeta,
} from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import { SuperImgError } from "@superimg/types";
import { getPreset } from "@superimg/stdlib";

// =============================================================================
// PLAYER-SPECIFIC TYPES (defined here, exported from this module)
// =============================================================================

/** Simple format aliases that map to stdlib presets */
const SIMPLE_ALIASES: Record<string, string> = {
  vertical: "instagram.video.reel", // 1080x1920
  horizontal: "youtube.video.long", // 1920x1080
  square: "instagram.video.feed", // 1080x1080
} as const;

/**
 * Format option: simple alias, stdlib preset path, or custom dimensions.
 *
 * Examples:
 * - "vertical" → 1080x1920
 * - "horizontal" → 1920x1080
 * - "square" → 1080x1080
 * - "youtube.video.short" → 1080x1920
 * - { width: 800, height: 600 } → custom dimensions
 */
export type FormatOption =
  | "vertical"
  | "horizontal"
  | "square"
  | string
  | { width: number; height: number };

/**
 * Resolve a format option to width/height dimensions.
 */
export function resolveFormat(format: FormatOption): { width: number; height: number } {
  if (typeof format === "object") {
    return format;
  }

  const presetPath = SIMPLE_ALIASES[format] ?? format;
  const preset = getPreset(presetPath);

  if (!preset) {
    throw new Error(`Unknown format: ${format}`);
  }

  return { width: preset.width, height: preset.height };
}

/**
 * Options for creating a Player instance
 */
export interface PlayerOptions {
  /** Container element or CSS selector */
  container: string | HTMLElement;
  /** Format for rendering - simple alias, stdlib preset path, or custom dimensions */
  format?: FormatOption;
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
export type PlayerInput = TemplateModule | ComposedTemplate;

export interface PlayerEvents {
  /** Fired on each frame render */
  frame: (frame: number) => void;
  /** Fired on each frame render with the raw HTML payload for debugging */
  frameRendered: (frame: number, html: string, compositeHtml: string) => void;
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
  /** Fired when the current scene changes (composed templates only) */
  scenechange: (scene: ResolvedScene) => void;
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
import { CheckpointResolver, createRenderContext, resolveConfigAssets } from "@superimg/core";
import { BrowserRenderer } from "@superimg/runtime";
import { buildCompositeHtml } from "@superimg/core/html";
import { loadAllAssetsWithMetadata } from "@superimg/runtime";
import { createPlayerStore, type PlayerStore, type PlayerConfig } from "./state.js";
import { createPlaybackController, type PlaybackController } from "./playback.js";
import { HtmlPresenter } from "./html-presenter.js";
import { CanvasPresenter } from "./canvas-presenter.js";

export interface LoadOptions {
  /** Explicit markers for non-scene checkpoints */
  markers?: Marker[];
}

/**
 * Options for capturing a frame as an image
 */
export interface CaptureOptions {
  /** Frame to capture. Omit for smart thumbnail frame selection. */
  frame?: number;
  /** Output format (default: 'dataUrl') */
  format?: "blob" | "dataUrl" | "canvas" | "imageData";
  /** MIME type for blob/dataUrl output (default: 'image/png') */
  mimeType?: "image/png" | "image/webp" | "image/jpeg";
  /** Quality for lossy formats (0-1, default: 0.92) */
  quality?: number;
}

/**
 * Result of capturing a frame
 */
export interface CapturedFrame {
  /** Blob (if format is 'blob') */
  blob?: Blob;
  /** Data URL (if format is 'dataUrl') */
  dataUrl?: string;
  /** Canvas element (if format is 'canvas') */
  canvas?: HTMLCanvasElement;
  /** Raw ImageData (if format is 'imageData') */
  imageData?: ImageData;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
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
  private presenter: FramePresenter;
  private _store: PlayerStore | null = null;
  private playbackController: PlaybackController | null = null;
  private _checkpointResolver: CheckpointResolver | null = null;
  private template: TemplateModule | ComposedTemplate | null = null;
  private _composedTemplate: ComposedTemplate | null = null;
  private _lastSceneIndex: number = -1;
  private _totalFrames: number = 0;
  private _fps: number = 30;
  private _format: FormatOption | undefined;
  private _renderWidth: number = 1920;
  private _renderHeight: number = 1080;
  private options: Required<Omit<PlayerOptions, "container" | "format">>;
  private events: Partial<PlayerEvents> = {};
  private _isReady = false;
  private _data: Record<string, unknown> = {};
  private _assetsMap: Record<string, AssetMeta> = {};

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

    // Store format option
    this._format = options.format;

    // Resolve initial dimensions from format if provided
    if (this._format) {
      const dims = resolveFormat(this._format);
      this._renderWidth = dims.width;
      this._renderHeight = dims.height;
    }

    // Set defaults
    this.options = {
      playbackMode: options.playbackMode ?? "once",
      loadMode: options.loadMode ?? "eager",
      hoverBehavior: options.hoverBehavior ?? "none",
      hoverDelayMs: options.hoverDelayMs ?? 200,
      maxCacheFrames: options.maxCacheFrames ?? 30,
      showControls: options.showControls ?? false,
    };

    // Always use HtmlPresenter for preview (CSS transform scaling)
    this.presenter = new HtmlPresenter(this.container);
  }

  /**
   * Load a template module
   *
   * @param input - Template module to load
   * @param loadOptions - Optional load options
   * @returns LoadResult with success/error status
   */
  async load(
    input: TemplateModule | ComposedTemplate,
    loadOptions?: LoadOptions
  ): Promise<LoadResult> {
    try {
      // Store template
      this.template = input;
      this._composedTemplate = isComposedTemplate(input) ? input : null;

      // Get config from template (both TemplateModule and ComposedTemplate have config)
      const fps = this._composedTemplate
        ? this._composedTemplate.fps
        : (this.template.config?.fps ?? 30);
      const durationSeconds = this._composedTemplate
        ? this._composedTemplate.durationSeconds
        : (this.template.config?.durationSeconds ?? 5);
      const totalFrames = this._composedTemplate
        ? this._composedTemplate.totalFrames
        : Math.ceil(durationSeconds * fps);

      // Resolve dimensions with precedence: format > template config > default
      const { width, height } = this.resolveDimensions(this.template);
      this._renderWidth = width;
      this._renderHeight = height;

      // Set presenter logical size
      if (this.presenter.setLogicalSize) {
        this.presenter.setLogicalSize(width, height);
      }

      this._totalFrames = totalFrames;
      this._fps = fps;

      // Load assets with metadata for ctx.assets
      const assetDeclarations = resolveConfigAssets(this.template.config?.assets);
      if (assetDeclarations.length > 0) {
        this._assetsMap = await loadAllAssetsWithMetadata(assetDeclarations);
      } else {
        this._assetsMap = {};
      }

      // Create checkpoint resolver: scene boundaries + explicit markers
      const markers: Marker[] = [];
      if (this._composedTemplate) {
        for (const s of this._composedTemplate.scenes) {
          markers.push({
            id: s.id,
            at: { type: "frame", value: s.startFrame },
            label: s.label,
          });
        }
      }
      if (loadOptions?.markers?.length) {
        markers.push(...loadOptions.markers);
      }
      if (markers.length > 0) {
        this._checkpointResolver = new CheckpointResolver(
          markers,
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
            // Fire scenechange when crossing scene boundary
            if (this._composedTemplate) {
              const scene = this._composedTemplate.getSceneAtFrame(frame);
              if (scene.index !== this._lastSceneIndex) {
                this._lastSceneIndex = scene.index;
                this.events.scenechange?.(scene);
              }
            }
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

      // Inject template CSS (inlineCss, stylesheets) into presenter
      const templateConfig = this._composedTemplate?.config ?? this.template?.config;
      if (this.presenter.injectStyles && templateConfig) {
        this.presenter.injectStyles(
          templateConfig.inlineCss ?? [],
          templateConfig.stylesheets ?? []
        );
      }

      // Warmup presenter
      if (this.presenter.warmup) {
        await this.presenter.warmup();
      }

      // Render first frame
      await this.renderFrame(0);

      // Initialize scene tracking for composed templates
      if (this._composedTemplate) {
        this._lastSceneIndex = this._composedTemplate.getSceneAtFrame(0).index;
      }

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
   * Render a specific frame. Public for export and advanced usage.
   */
  async renderFrame(frame: number): Promise<void> {
    if (!this.template || !this._store) {
      return;
    }

    // Build context: merge template.defaults with external data (ComposedTemplate has no defaults)
    const defaults =
      "defaults" in this.template ? this.template.defaults : undefined;
    const mergedData = {
      ...(defaults ?? {}),
      ...this._data,
    };
    const ctx = createRenderContext(
      frame,
      this._fps,
      this._totalFrames,
      this._renderWidth,
      this._renderHeight,
      mergedData,
      "default",
      this._assetsMap
    );

    try {
      // Render HTML string
      const html = this.template.render(ctx);
      // Compose with template's background (if any)
      const templateConfig = this._composedTemplate?.config ?? this.template?.config;
      const compositeHtml = buildCompositeHtml(
        html,
        templateConfig?.background,
        templateConfig?.watermark,
        this._renderWidth,
        this._renderHeight
      );
      // Present frame
      await this.presenter.present(compositeHtml, ctx);
      // Fire debugging event
      this.events.frameRendered?.(frame, html, compositeHtml);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Create enriched error with context
      const enrichedError = new Error(
        `Render error at frame ${frame} (${ctx.sceneTimeSeconds.toFixed(3)}s, ` +
          `${(ctx.sceneProgress * 100).toFixed(1)}% progress): ${err.message}`
      );
      // Fire error event with context
      this.events.error?.(enrichedError);
    }
  }

  /**
   * Resolve dimensions with precedence: format > template config > default
   */
  private resolveDimensions(
    template: TemplateModule | ComposedTemplate
  ): { width: number; height: number } {
    // 1. format option (highest priority)
    if (this._format) {
      return resolveFormat(this._format);
    }
    // 2. template config
    if (template.config?.width && template.config?.height) {
      return { width: template.config.width, height: template.config.height };
    }
    // 3. default fallback
    return { width: 1920, height: 1080 };
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

  /**
   * Change the format and re-render at the new dimensions.
   */
  setFormat(format: FormatOption): void {
    const { width, height } = resolveFormat(format);
    this._format = format;
    this._renderWidth = width;
    this._renderHeight = height;

    if (this.presenter.setLogicalSize) {
      this.presenter.setLogicalSize(width, height);
    }

    // Re-render current frame at new dimensions
    if (this._store) {
      this.renderFrame(this._store.getState().currentFrame);
    }
  }

  /**
   * Set template data (merged with template.defaults, overrides on conflict).
   * Re-renders the current frame.
   */
  setData(data: Record<string, unknown>): void {
    this._data = { ...this._data, ...data };
    if (this._store) {
      void this.renderFrame(this._store.getState().currentFrame);
    }
  }

  /**
   * Get checkpoints (from scene boundaries or markers)
   */
  getCheckpoints(): Checkpoint[] {
    if (this._composedTemplate) {
      return this._composedTemplate.getCheckpoints();
    }
    return this._checkpointResolver?.getAll() ?? [];
  }

  /**
   * Get the current format option.
   */
  get format(): FormatOption | undefined {
    return this._format;
  }

  /**
   * Get the current playback mode.
   */
  get playbackMode(): PlaybackMode {
    return this.options.playbackMode;
  }

  /**
   * Set the playback mode.
   */
  set playbackMode(mode: PlaybackMode) {
    this.options.playbackMode = mode;
  }

  /**
   * Get the current render width.
   */
  get renderWidth(): number {
    return this._renderWidth;
  }

  /**
   * Get the current render height.
   */
  get renderHeight(): number {
    return this._renderHeight;
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

  /** The presenter element (for advanced usage) */
  get element(): HTMLElement {
    return this.presenter.getElement();
  }

  /** The checkpoint resolver (for timeline marker rendering) */
  get checkpointResolver(): CheckpointResolver | null {
    return this._checkpointResolver;
  }

  /** Whether the loaded template is a ComposedTemplate */
  get isComposed(): boolean {
    return this._composedTemplate !== null;
  }

  /** The composed template (null if single template) */
  get composedTemplate(): ComposedTemplate | null {
    return this._composedTemplate;
  }

  /** Get scenes (composed templates only) */
  getScenes(): ResolvedScene[] {
    return this._composedTemplate
      ? [...this._composedTemplate.scenes]
      : [];
  }

  /** Get current scene (composed templates only) */
  getCurrentScene(): ResolvedScene | null {
    if (!this._composedTemplate || !this._store) return null;
    return this._composedTemplate.getSceneAtFrame(
      this._store.getState().currentFrame
    );
  }

  /** Seek to scene by index or id */
  seekToScene(indexOrId: number | string): void {
    if (!this._composedTemplate || !this._store) {
      throw new PlayerNotReadyError("seekToScene");
    }
    const scene =
      typeof indexOrId === "number"
        ? this._composedTemplate.getScene(indexOrId)
        : this._composedTemplate.getSceneById(indexOrId);
    if (!scene) {
      throw new Error(`Scene not found: ${indexOrId}`);
    }
    this._store.getState().setFrame(scene.startFrame);
  }

  /** Go to next scene */
  nextScene(): void {
    if (!this._composedTemplate || !this._store) {
      throw new PlayerNotReadyError("nextScene");
    }
    const current = this._composedTemplate.getSceneAtFrame(
      this._store.getState().currentFrame
    );
    const next = this._composedTemplate.getScene(current.index + 1);
    if (next) {
      this._store.getState().setFrame(next.startFrame);
    }
  }

  /** Go to previous scene */
  previousScene(): void {
    if (!this._composedTemplate || !this._store) {
      throw new PlayerNotReadyError("previousScene");
    }
    const current = this._composedTemplate.getSceneAtFrame(
      this._store.getState().currentFrame
    );
    const prev = this._composedTemplate.getScene(current.index - 1);
    if (prev) {
      this._store.getState().setFrame(prev.startFrame);
    }
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
  // FRAME CAPTURE
  // ==========================================================================

  /**
   * Get the best frame to use for thumbnail.
   * Priority: config.thumbnailAt > scene boundary (skip intro) > 25% fallback
   */
  private getThumbnailFrame(): number {
    const config = this._composedTemplate?.config ?? this.template?.config;

    // 1. Explicit config.thumbnailAt
    if (config?.thumbnailAt !== undefined) {
      const at = config.thumbnailAt;
      // If 0 < at <= 1, treat as progress; else treat as frame number
      if (at > 0 && at <= 1) {
        return Math.floor(at * this._totalFrames);
      }
      return Math.floor(at);
    }

    // 2. Scene boundary - use second scene start (skip intro)
    if (this._composedTemplate && this._composedTemplate.scenes.length > 1) {
      return this._composedTemplate.scenes[1].startFrame;
    }

    // 3. Fallback to 25% of duration
    return Math.floor(this._totalFrames * 0.25);
  }

  /**
   * Capture a frame as an image.
   *
   * @example
   * ```typescript
   * // Smart thumbnail (recommended) - auto-selects best frame
   * const { dataUrl } = await player.captureFrame();
   * img.src = dataUrl;
   *
   * // Specific frame with options
   * const { blob } = await player.captureFrame({ frame: 30, format: 'blob', mimeType: 'image/webp' });
   * ```
   *
   * @param options - Capture options (frame, format, mimeType, quality)
   * @returns CapturedFrame with the requested format
   */
  async captureFrame(options?: CaptureOptions): Promise<CapturedFrame> {
    if (!this.template || !this._store) {
      throw new PlayerNotReadyError("captureFrame");
    }

    const targetFrame = options?.frame ?? this.getThumbnailFrame();
    const format = options?.format ?? "dataUrl";
    const mimeType = options?.mimeType ?? "image/png";
    const quality = options?.quality ?? 0.92;

    // Build render context for this frame
    const defaults = "defaults" in this.template ? this.template.defaults : undefined;
    const mergedData = { ...(defaults ?? {}), ...this._data };
    const ctx = createRenderContext(
      targetFrame,
      this._fps,
      this._totalFrames,
      this._renderWidth,
      this._renderHeight,
      mergedData,
      "default",
      this._assetsMap
    );

    // Render HTML
    const html = this.template.render(ctx);
    const templateConfig = this._composedTemplate?.config ?? this.template?.config;
    const { buildCompositeHtml } = await import("@superimg/core/html");
    const compositeHtml = buildCompositeHtml(
      html,
      templateConfig?.background,
      templateConfig?.watermark,
      this._renderWidth,
      this._renderHeight
    );

    // Use BrowserRenderer to capture to ImageData
    const renderer = new BrowserRenderer();
    const imageData = await renderer.render(compositeHtml, {
      width: this._renderWidth,
      height: this._renderHeight,
      fonts: templateConfig?.fonts,
      stylesheets: templateConfig?.stylesheets,
      inlineCss: templateConfig?.inlineCss,
      tailwind: templateConfig?.tailwind,
    });

    // Create canvas with the captured frame
    const canvas = document.createElement("canvas");
    canvas.width = this._renderWidth;
    canvas.height = this._renderHeight;
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.putImageData(imageData, 0, 0);

    // Build result based on requested format
    const result: CapturedFrame = {
      width: this._renderWidth,
      height: this._renderHeight,
    };

    if (format === "imageData") {
      result.imageData = imageData;
    } else if (format === "canvas") {
      result.canvas = canvas;
    } else if (format === "blob") {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          mimeType,
          quality
        );
      });
      result.blob = blob;
    } else {
      // dataUrl (default)
      result.dataUrl = canvas.toDataURL(mimeType, quality);
    }

    return result;
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
    this._assetsMap = {};
    this.presenter.dispose();
    this.events = {};
    this._isReady = false;
  }
}
