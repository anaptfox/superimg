//! SuperImg Types - Core type definitions
//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback

import type { Stdlib } from "./stdlib.js";

// =============================================================================
// BRANDED TYPES - Prevent mixing structurally identical but semantically different values
// =============================================================================

declare const FrameBrand: unique symbol;
declare const ProgressBrand: unique symbol;
declare const DurationSecondsBrand: unique symbol;
declare const DurationFramesBrand: unique symbol;
declare const TimeSecondsBrand: unique symbol;

/** Frame number (0-indexed) */
export type FrameNumber = number & { readonly [FrameBrand]: typeof FrameBrand };

/** Progress value (0-1) */
export type Progress = number & { readonly [ProgressBrand]: typeof ProgressBrand };

/** Duration in seconds */
export type DurationSeconds = number & { readonly [DurationSecondsBrand]: typeof DurationSecondsBrand };

/** Duration in frames */
export type DurationFrames = number & { readonly [DurationFramesBrand]: typeof DurationFramesBrand };

/** Time in seconds */
export type TimeSeconds = number & { readonly [TimeSecondsBrand]: typeof TimeSecondsBrand };

// Helper functions to create branded values (for internal use)
export function frame(n: number): FrameNumber { return n as FrameNumber; }
export function progress(n: number): Progress { return n as Progress; }
export function durationSeconds(n: number): DurationSeconds { return n as DurationSeconds; }
export function durationFrames(n: number): DurationFrames { return n as DurationFrames; }
export function timeSeconds(n: number): TimeSeconds { return n as TimeSeconds; }

/**
 * Define a template module with full type inference from defaults.
 * This is the recommended way to create templates.
 *
 * @example
 * ```typescript
 * import { defineTemplate } from 'superimg';
 *
 * export default defineTemplate({
 *   defaults: { title: 'Hello', color: '#fff' },
 *   config: { width: 1920, height: 1080, fps: 30, durationSeconds: 5 },
 *   render(ctx) {
 *     return `<div style="color: ${ctx.data.color}">${ctx.data.title}</div>`;
 *   },
 * });
 * ```
 */
export function defineTemplate<TData>(
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
export interface RenderContext<
  TData = Record<string, unknown>,
> {
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
  /** Template data (merged from template defaults + incoming data) */
  data: TData;

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
 * A template module exports a render function and optional config/defaults.
 */
export interface TemplateModule<
  TData = Record<string, unknown>,
> {
  /** Render function that returns HTML string */
  render: (ctx: RenderContext<TData>) => string;
  /** Optional configuration */
  config?: TemplateConfig;
  /** Optional default data values (merged with incoming data) */
  defaults?: Partial<TData>;
}

export interface OutputPreset {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** FPS override for this output */
  fps?: number;
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
   * Default duration in seconds.
   *
   * Duration precedence (highest wins):
   * 1. CLI flags (`--duration`)
   * 2. This `config.durationSeconds` value
   * 3. Built-in default (5 s)
   */
  durationSeconds?: number;
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
}

// =============================================================================
// ENCODING OPTIONS
// =============================================================================

export type VideoCodecPreference = "avc" | "vp9" | "av1";
export type AudioCodecPreference = "aac" | "opus";
export type QualityPreset = "very-low" | "low" | "medium" | "high" | "very-high";
export type OutputFormat = "mp4" | "webm";

export interface EncodingOptions {
  format?: OutputFormat;
  video?: {
    codec?: VideoCodecPreference | VideoCodecPreference[];
    bitrate?: number | QualityPreset;
    keyFrameInterval?: number;
    alpha?: "discard" | "keep";
  };
  audio?: {
    codec?: AudioCodecPreference | AudioCodecPreference[];
    bitrate?: number | QualityPreset;
  };
}
