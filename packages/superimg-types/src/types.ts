//! SuperImg Types - Core type definitions
//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback

import type { Stdlib } from "./stdlib.js";
import type { DirectorOf, DirectorOpts, PhaseConfig } from "@superimg/stdlib/director";
import type { Track } from "@superimg/stdlib/track";
import type { Checkpoint } from "./checkpoint.js";
import type { EncodingOptions, OutputFormat } from "./encoding-types.js";
import type { JsonObject } from "./json.js";
import type { AudioClip, AudioValue } from "./audio.js";

export type { AudioClip, AudioValue } from "./audio.js";

/**
 * The medium a template targets — i.e. which rasterizer family turns its markup
 * into pixels.
 *  - "html": full-CSS markup → Chromium (Playwright) / in-page iframe.
 *  - "svg": vector markup → browser-free resvg-wasm (build time + edge).
 */
export type Medium = "html" | "svg";

// =============================================================================
// TIMELINE — single scene clock
// =============================================================================

/** Unified scene-local clock. `seconds` is always `progress × durationSeconds`. */
export interface Timeline {
  frame: number;
  fps: number;
  /** Normalized scene progress 0→1 (inclusive on last frame). */
  progress: number;
  /** Scene time in seconds: progress × durationSeconds. */
  seconds: number;
  durationSeconds: number;
  totalFrames: number;
}

/** Input for `ctx.track()` — transcript / marker sources. */
export interface TrackSource {
  words?: Array<{ text: string; start: number; end: number; type?: string }>;
  markers?: Record<string, number>;
}

// =============================================================================
// RENDER CONTEXT
// =============================================================================

/**
 * Context passed to template render functions.
 */
export interface RenderContext<TData = JsonObject> {
  // === Stdlib (explicit, no ambient global) ===
  /** Standard library utilities (easing, math, color, etc.) */
  std: Stdlib;

  /** Scene-local unified clock. */
  timeline: Timeline;

  /**
   * Phase choreography factory. Replaces the former `ctx.score()`.
   * @example const t = ctx.director({ intro: "10%", main: "75%", hold: "15%" });
   * @example const t = ctx.director(std.phases.recipe("punchy"), { tone: "social" });
   */
  director: <P extends PhaseConfig | undefined = undefined>(
    phases?: P,
    opts?: DirectorOpts,
  ) => DirectorOf<P>;

  /**
   * Named sync track (transcript, markers). Uses `timeline.seconds`.
   * @example const vo = ctx.track({ words: data.words });
   */
  track: (opts: TrackSource) => Track;

  // === Global Position (entire video) ===
  /** Current frame number across entire video (0-indexed) */
  globalFrame: number;
  /** Current time in seconds across entire video */
  globalTimeSeconds: number;
  /** Total frames in video */
  totalFrames: number;
  /** Total duration in seconds */
  totalDurationSeconds: number;

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
  /** Template data (merged from template defaults + incoming data) */
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
 * A template module exports a render function and optional config/sample.
 */
/**
 * A template module — the unified result of `define()`.
 *
 * The two axes that used to be separate factories are now fields:
 *  - `medium`   — "html" | "svg" (which rasterizer renders it).
 *  - `animated` — true when the config declares both `fps` and `duration`.
 *
 * `render`'s context is narrowed to the precise variant at the `define()` call
 * site (via overloads); the stored type is permissive so the engine — which
 * always builds a full temporal `RenderContext` — can call it uniformly.
 */
export interface TemplateModule<
  TData = JsonObject,
> {
  /** Which rasterizer family renders this template. */
  readonly medium: Medium;
  /**
   * True when the template renders N frames.
   * Animated when config has `fps` and (`duration` or a `resolve` hook that supplies duration).
   */
  readonly animated: boolean;
  /** Render function that returns HTML or SVG markup. */
  render: (ctx: RenderContext<TData>) => string;
  /** Optional configuration */
  config?: TemplateConfig;
  /** Sample/preview data — the template renders from this when no external data is provided. */
  sample?: TData;
  /**
   * Optional pre-render hook. Runs once per job (not per frame).
   * May set duration/size/data/markers/phases before any frame is rendered.
   * @see ResolveInput / ResolveResult in resolve.ts
   */
  resolve?: import("./resolve.js").ResolveFn<TData>;
}

export interface OutputPreset {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** FPS override for this output */
  fps?: number;
  /** Output format override for this preset */
  format?: OutputFormat;
  /** Directory relative to project root to save the file */
  outDir?: string;
  /** Exact filename or path override to save the file (e.g. "final.mp4") */
  outFile?: string;
}

/**
 * Frame readiness policy for headless capture (Playwright).
 * Authors stamp `data-superimg-wait="label"` and/or call
 * `window.__superimgReady.done(label)` from in-frame scripts.
 */
export interface FrameReadinessPolicy {
  /** Overall wait timeout in ms. Default 8000. */
  timeoutMs?: number;
  /**
   * Implicit waits each frame. Default: `["fonts", "images"]`.
   * - `fonts`: `document.fonts.ready`
   * - `images`: decode all `<img>` in `#frame` (covers video.sync injects)
   */
  waitImplicit?: Array<"fonts" | "images">;
}

/**
 * Shared configuration base for project and template configs.
 *
 * NOTE: These fields cascade from `_config.ts` files down to individual templates.
 * If defined in a parent `_config.ts`, they act as defaults for all templates in
 * that folder (and its children).
 */
export interface BaseConfig {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Frames per second */
  fps?: number;
  /** Default duration. Accepts number (seconds), "5s", "500ms", or "30f". */
  duration?: Duration;
  /**
   * Headless capture readiness (Playwright). Does not affect preview morphdom.
   * @see FrameReadinessPolicy
   */
  readiness?: FrameReadinessPolicy;
  /**
   * List of Google Fonts to load.
   * Format: "Font+Name" or "Font+Name:wght@400;700"
   */
  fonts?: string[];
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
  /** Named output presets */
  outputs?: Record<string, OutputPreset>;
  /**
   * Automatically generate responsive `@1x` and `@2x` variations
   * (only applies to image formats like webp/png).
   */
  responsive?: boolean;
  /**
   * Logical type or tag for this template (e.g. "og" for Open Graph images).
   */
  type?: string;
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
   * Audio clips to mix into the rendered video.
   * Accepts a single clip, clip array, or full timeline with mix options.
   */
  audio?: AudioValue;
}

export interface DeployConfig {
  /** Deployment target. Defaults to "cloudflare-container". */
  target?: "cloudflare-container";
  /** CF Worker name. Defaults to the project directory name. */
  workerName?: string;
}

/**
 * Project-level or folder-level config from _config.ts.
 * Cascades from parent to child directories.
 */
export interface ProjectConfig extends BaseConfig {
  /** Default output directory for all templates relative to project root */
  outDir?: string;
  /** Cloudflare deployment configuration. */
  deploy?: DeployConfig;
}

/**
 * Define a project/folder config for _config.ts files.
 * Provides type inference and validation.
 */
export function defineConfig(config: ProjectConfig): ProjectConfig {
  return config;
}

/**
 * Per-template configuration.
 * Extends BaseConfig with render-time concerns that only make sense per-template.
 */
export interface TemplateConfig extends BaseConfig {
  /**
   * Frame to use for thumbnail/preview image.
   * - Integer >= 1: specific frame number
   * - Decimal 0-1: progress through video (e.g., 0.25 = 25%)
   * - Omit: auto-select (scene boundary or 25% fallback)
   */
  thumbnailAt?: number;
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
  /**
   * Rendering mode for this template.
   * - 'frame' (default): render() is called per frame; CSS transitions don't animate naturally
   * - 'animation': Playwright fake clock advances per frame so CSS transitions/animations work deterministically
   */
  mode?: 'frame' | 'animation';
  /**
   * GIF encoding options, applied when a target's sink format is `gif`.
   * (GIF is now an output sink, not a template kind.)
   */
  gif?: {
    loop?: number;
    maxColors?: number;
    dither?: string;
  };
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

/** Easing name for transitions. Must be one of the named easings from the stdlib easing map. */
export type EasingName =
  | "linear"
  | "easeInQuad" | "easeOutQuad" | "easeInOutQuad"
  | "easeInSine" | "easeOutSine" | "easeInOutSine"
  | "easeInCubic" | "easeOutCubic" | "easeInOutCubic"
  | "easeInQuart" | "easeOutQuart" | "easeInOutQuart"
  | "easeInQuint" | "easeOutQuint" | "easeInOutQuint"
  | "easeInExpo" | "easeOutExpo" | "easeInOutExpo"
  | "easeInCirc" | "easeOutCirc" | "easeInOutCirc"
  | "easeInBack" | "easeOutBack" | "easeInOutBack"
  | "easeInElastic" | "easeOutElastic" | "easeInOutElastic"
  | "easeInBounce" | "easeOutBounce" | "easeInOutBounce";

/** Transition definition for scene enter/exit */
export interface Transition {
  type: TransitionType;
  duration: Duration;
  easing?: EasingName;
}

/** Input definition for a scene in compose() */
export interface SceneDefinition<TData = JsonObject> {
  template: TemplateModule<TData>;
  duration?: Duration;
  id?: string;
  label?: string;
  data?: Partial<TData>;
  audio?: AudioClip | AudioClip[];
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
  data: JsonObject;
  enterTransition?: ResolvedTransition;
  exitTransition?: ResolvedTransition;
}

/** Shared scene API for composed templates (HTML and SVG). */
export interface ComposedTemplateBase {
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
  /** Render markup for given frame */
  render(ctx: RenderContext): string;
  /** Get checkpoints from scene boundaries */
  getCheckpoints(): Checkpoint[];
}

/** Output of compose() - multi-scene animated reel (HTML or SVG). */
export interface ComposedTemplate extends ComposedTemplateBase {
  readonly medium: Medium;
  readonly animated: true;
  readonly type: "composed";
}

// =============================================================================
// MODE TYPES - Replace booleans with explicit named modes
// =============================================================================

/** Playback behavior when video ends */
export type PlaybackMode = "once" | "loop";

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

export type BackgroundValue = string | BackgroundOptions;

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
