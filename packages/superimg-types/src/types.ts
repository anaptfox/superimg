//! SuperImg Types - Core type definitions
//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback

import type { Stdlib } from "./stdlib.js";
import type { Checkpoint } from "./checkpoint.js";


/**
 * Define a template module with full type inference.
 * This is the recommended way to create templates.
 *
 * @example
 * ```typescript
 * import { defineScene } from 'superimg';
 *
 * export default defineScene({
 *   data: { title: 'Hello', color: '#fff' },
 *   config: { width: 1920, height: 1080, fps: 30, duration: 5 },
 *   render(ctx) {
 *     return `<div style="color: ${ctx.data.color}">${ctx.data.title}</div>`;
 *   },
 * });
 * ```
 */
export function defineScene<TData>(
  module: TemplateModule<TData>
): TemplateModule<TData> {
  return module;
}

// =============================================================================
// RENDER CONTEXT - Explicit, non-overlapping field names
// =============================================================================

/**
 * Context passed to template render functions.
 *
 * Field naming convention:
 * - `global*` - Position within entire video
 * - `scene*` - Position within current template (equals global* in single-template mode)
 * - Explicit units in names (Seconds, Frames)
 */
export interface RenderContext<TData = Record<string, unknown>> {
  // === Stdlib (explicit, no ambient global) ===
  /** Standard library utilities (easing, math, color, etc.) */
  std: Stdlib;

  // === Global Position (entire video) ===
  /** Current frame number across entire video (0-indexed) */
  globalFrame: number;
  /** Current time in seconds across entire video */
  globalTimeSeconds: number;
  /** Progress through entire video (0-1) */
  globalProgress: number;
  /** Total frames in video */
  totalFrames: number;
  /** Total duration in seconds */
  totalDurationSeconds: number;

  // === Scene Position (kept for backward compat, equals global in single-template mode) ===
  /** Current frame within this scene (0-indexed) */
  sceneFrame: number;
  /** Current time in seconds within this scene */
  sceneTimeSeconds: number;
  /** Progress through this scene (0-1) */
  sceneProgress: number;
  /** Total frames in this scene */
  sceneTotalFrames: number;
  /** Duration of this scene in seconds */
  sceneDurationSeconds: number;

  // === Scene Metadata ===
  /** Index of current scene (0-indexed) */
  sceneIndex: number;
  /** ID of current scene */
  sceneId: string;

  // === Video Info ===
  /** Frames per second */
  fps: number;
  /** Whether the video has a finite duration */
  isFinite: boolean;

  // === Dimensions ===
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Aspect ratio (width / height) */
  aspectRatio: number;
  /** true if height > width */
  isPortrait: boolean;
  /** true if width > height */
  isLandscape: boolean;
  /** true if width === height */
  isSquare: boolean;

  // === Data ===
  /** Template data (merged from template data + companion data + incoming data) */
  data: TData;

  /** Resolved static assets with full metadata (from config.assets) */
  assets: Record<string, AssetMeta>;

  /** Get URL for a file in the template's co-located assets/ folder */
  asset: (filename: string) => string;

  // === Output Info ===
  /** Output configuration */
  output: OutputInfo;

  // === CSS Viewport (for responsive templates) ===
  cssViewport?: CssViewport;
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

export interface OutputInfo {
  name: string;
  width: number;
  height: number;
  fit: FitMode;
}

export type FitMode = "stretch" | "contain" | "cover";

export interface CssViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

// =============================================================================
// TEMPLATE MODULE
// =============================================================================

/**
 * A template module exports a render function and optional config/data.
 */
export interface TemplateModule<
  TData = Record<string, unknown>,
> {
  /** Render function that returns HTML string */
  render: (ctx: RenderContext<TData>) => string;
  /** Optional configuration */
  config?: TemplateConfig;
  /** Static data values (merged with companion .data.ts and incoming data) */
  data?: Partial<TData>;
}

export interface OutputPreset {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** FPS override for this output */
  fps?: number;
  /** Directory relative to project root to save the file */
  outDir?: string;
  /** Exact filename or path override to save the file (e.g. "final.mp4") */
  outFile?: string;
}

/**
 * Project-level or folder-level config from _config.ts.
 * Cascades from parent to child directories.
 */
export interface ProjectConfig {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Frames per second */
  fps?: number;
  /** Default duration. Accepts number (seconds), "5s", "500ms", or "30f". */
  duration?: Duration;
  /** List of Google Fonts to load */
  fonts?: string[];
  /** Raw CSS strings to inject */
  inlineCss?: string[];
  /** Stylesheet URLs to load */
  stylesheets?: string[];
  /** Default output directory for all templates relative to project root */
  outDir?: string;
  /** Named output presets */
  outputs?: Record<string, OutputPreset>;
  /**
   * Enable Tailwind v4 Play CDN.
   * - `true`: Enable with defaults
   * - `TailwindConfig`: Enable with custom @theme CSS
   */
  tailwind?: boolean | TailwindConfig;
  /**
   * Optional watermark rendered over the video.
   * Can be an image URL, text string, or configuration object.
   */
  watermark?: WatermarkValue;
  /**
   * Background rendered into the video (solid color or image).
   * Composed behind template content via buildCompositeHtml.
   */
  background?: BackgroundValue;
  /**
   * Audio track to mix into the rendered video.
   * Can be a file path string or an AudioOptions object with volume, fade, and loop controls.
   */
  audio?: AudioValue;
}

/**
 * Define a project/folder config for _config.ts files.
 * Provides type inference and validation.
 */
export function defineConfig(config: ProjectConfig): ProjectConfig {
  return config;
}

export interface TemplateConfig {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Frames per second */
  fps?: number;
  /**
   * List of Google Fonts to load.
   * Format: "Font+Name" or "Font+Name:wght@400;700"
   */
  fonts?: string[];
  /**
   * Default duration. Accepts number (seconds), "5s", "500ms", or "30f".
   *
   * Duration precedence (highest wins):
   * 1. CLI flags (`--duration`)
   * 2. This `config.duration` value
   * 3. Built-in default (5 s)
   */
  duration?: Duration;
  /**
   * Frame to use for thumbnail/preview image.
   * - Integer >= 1: specific frame number
   * - Decimal 0-1: progress through video (e.g., 0.25 = 25%)
   * - Omit: auto-select (scene boundary or 25% fallback)
   */
  thumbnailAt?: number;
  /**
   * Raw CSS strings to inject into the page (e.g. utility classes, Tailwind precompiled output).
   * Injected once per render session, not per frame.
   */
  inlineCss?: string[];
  /**
   * Stylesheet URLs to load (e.g. CDN Tailwind, local file paths).
   * Injected once per render session, not per frame.
   */
  stylesheets?: string[];
  /**
   * Background rendered into the video (solid color or image).
   * Composed behind template content via buildCompositeHtml.
   */
  background?: BackgroundValue;
  /** Named output presets */
  outputs?: Record<string, OutputPreset>;
  /**
   * Enable Tailwind v4 Play CDN.
   * - `true`: Enable with defaults
   * - `TailwindConfig`: Enable with custom @theme CSS
   */
  tailwind?: boolean | TailwindConfig;
  /**
   * Optional watermark rendered over the video.
   * Can be an image URL, text string, or configuration object.
   */
  watermark?: WatermarkValue;
  /**
   * Audio track to mix into the rendered video.
   * Can be a file path string or an AudioOptions object with volume, fade, and loop controls.
   */
  audio?: AudioValue;
  /**
   * Static assets to preload before rendering.
   * Keys become accessible via ctx.assets.{key}
   */
  assets?: Record<string, string | AssetDeclaration>;
  /**
   * Default encoding options for this template.
   * CLI flags and programmatic API options override these.
   */
  encoding?: EncodingOptions;
}

// =============================================================================
// SCENE COMPOSITION TYPES
// =============================================================================

/** Duration: number (seconds), string ('5s', '500ms', '30f'), or undefined */
export type Duration = number | `${number}s` | `${number}ms` | `${number}f`;

/** Transition type for scene enter/exit */
export type TransitionType =
  | "none"
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down";

/** Easing name for transitions (matches stdlib EasingName) */
export type EasingName = string;

/** Transition definition for scene enter/exit */
export interface Transition {
  type: TransitionType;
  duration: Duration;
  easing?: EasingName;
}

/** Input definition for a scene in compose() */
export interface SceneDefinition<TData = Record<string, unknown>> {
  template: TemplateModule<TData>;
  duration?: Duration;
  id?: string;
  label?: string;
  data?: Partial<TData>;
  enter?: Transition;
  exit?: Transition;
}

/** Resolved transition with numeric duration in seconds */
export interface ResolvedTransition {
  type: TransitionType;
  duration: number;
  easing?: EasingName;
}

/** Resolved scene with frame boundaries (internal) */
export interface ResolvedScene {
  id: string;
  label?: string;
  index: number;
  template: TemplateModule;
  startFrame: number;
  endFrame: number;
  totalFrames: number;
  duration: number;
  data: Record<string, unknown>;
  enterTransition?: ResolvedTransition;
  exitTransition?: ResolvedTransition;
}

/** Output of compose() - first-class composed video with scene access */
export interface ComposedTemplate {
  readonly type: "composed";
  readonly scenes: readonly ResolvedScene[];
  readonly totalFrames: number;
  readonly duration: number;
  readonly fps: number;
  readonly config: TemplateConfig;

  /** Get scene by index */
  getScene(index: number): ResolvedScene | undefined;
  /** Get scene by id */
  getSceneById(id: string): ResolvedScene | undefined;
  /** Get scene at given frame */
  getSceneAtFrame(frame: number): ResolvedScene;
  /** Render HTML for given frame */
  render(ctx: RenderContext): string;
  /** Get checkpoints from scene boundaries */
  getCheckpoints(): Checkpoint[];
}

// =============================================================================
// MODE TYPES - Replace booleans with explicit named modes
// =============================================================================

/** Playback behavior when video ends */
export type PlaybackMode = "once" | "loop" | "ping-pong";

/** When to load/compile the template */
export type LoadMode = "eager" | "lazy";

/** What happens on hover */
export type HoverBehavior = "none" | "play" | "preview-scrub";

// =============================================================================
// ASSET TYPES
// =============================================================================


/** Declaration for a static asset in config.assets */
export interface AssetDeclaration {
  src: string;
  /** Auto-detected from extension if omitted */
  type?: "image" | "video" | "audio";
}

/** Base metadata for all assets */
export interface AssetMetaBase {
  /** Resolved URL to the asset */
  url: string;
  /** MIME type (e.g., 'image/png', 'video/mp4') */
  mimeType: string;
  /** File size in bytes */
  size: number;
}

/** Metadata for image assets */
export interface ImageAssetMeta extends AssetMetaBase {
  type: "image";
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Metadata for video assets */
export interface VideoAssetMeta extends AssetMetaBase {
  type: "video";
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Duration in seconds */
  duration: number;
}

/** Metadata for audio assets */
export interface AudioAssetMeta extends AssetMetaBase {
  type: "audio";
  /** Duration in seconds */
  duration: number;
}

export type AssetMeta = ImageAssetMeta | VideoAssetMeta | AudioAssetMeta;

export interface BackgroundOptions {
  src: string;
  fit?: FitMode;
  loop?: boolean;
  opacity?: number;
}

export interface AudioOptions {
  src: string;
  loop?: boolean;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export type BackgroundValue = string | BackgroundOptions;
export type AudioValue = string | AudioOptions;

export interface WatermarkOptions {
  /** The type of watermark to render */
  type?: "image" | "text" | "html";
  /** The content of the watermark (image URL, text string, or raw HTML) */
  content: string;
  /** Optional URL to link the watermark to (makes it clickable in the player) */
  href?: string;
  /** Position of the watermark on the screen */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  /** Opacity of the watermark (0 to 1) */
  opacity?: number;
  /** Width of the watermark (typically for images) */
  width?: number | string;
  /** Height of the watermark (typically for images) */
  height?: number | string;
  /** Additional CSS styles to apply to the watermark container */
  style?: Record<string, string>;
  /** Provide CSS classes to apply to the watermark container */
  className?: string;
}

export type WatermarkValue = string | WatermarkOptions;

// =============================================================================
// TAILWIND CONFIG
// =============================================================================

/**
 * Tailwind v4 Play CDN configuration.
 * @see https://tailwindcss.com/docs/installation/play-cdn
 */
export interface TailwindConfig {
  /**
   * Custom Tailwind CSS (supports @theme, @layer, etc.)
   * Injected as `<style type="text/tailwindcss">`.
   *
   * @example
   * ```typescript
   * css: `
   *   @theme {
   *     --color-brand: #ff6b35;
   *   }
   * `
   * ```
   */
  css?: string;
}

// =============================================================================
// RENDER OPTIONS (kept for internal use)
// =============================================================================

export interface RenderOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  /** List of Google Fonts to load */
  fonts?: string[];
  /** Raw CSS strings to inject (e.g. utility classes, Tailwind precompiled) */
  inlineCss?: string[];
  /** Stylesheet URLs to load */
  stylesheets?: string[];
  /** Tailwind v4 Play CDN config */
  tailwind?: boolean | TailwindConfig;
}

// =============================================================================
// ENCODING OPTIONS
// =============================================================================

export type VideoCodecPreference = "avc" | "vp9" | "av1";
export type AudioCodecPreference = "aac" | "opus";
export type QualityPreset = "very-low" | "low" | "medium" | "high" | "very-high";
export type OutputFormat = "mp4" | "webm";
export type BitrateMode = "constant" | "variable";
export type LatencyMode = "quality" | "realtime";
export type HardwareAcceleration = "no-preference" | "prefer-hardware" | "prefer-software";

export interface EncodingOptions {
  format?: OutputFormat;
  video?: {
    codec?: VideoCodecPreference | VideoCodecPreference[];
    bitrate?: number | QualityPreset;
    bitrateMode?: BitrateMode;
    keyFrameInterval?: number;
    alpha?: "discard" | "keep";
    latencyMode?: LatencyMode;
    hardwareAcceleration?: HardwareAcceleration;
  };
  audio?: {
    codec?: AudioCodecPreference | AudioCodecPreference[];
    bitrate?: number | QualityPreset;
    bitrateMode?: BitrateMode;
  };
  mp4?: {
    fastStart?: false | "in-memory" | "fragmented";
  };
  webm?: {
    minimumClusterDuration?: number;
  };
}
