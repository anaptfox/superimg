//! The unified `define()` template factory.
//!
//! Unified template factory — one `define()` for all output kinds.
//! Three orthogonal axes select behaviour:
//!  - medium:   "html" (Chromium) | "svg" (resvg-wasm, browser-free, edge).
//!  - animated: inferred from the config — true iff it declares fps AND
//!              (duration OR a `resolve` hook that will supply duration).
//!  - sink:     chosen later (config.outputs / CLI / `as`), not at authoring time.
//!
//! TypeScript narrows `ctx` to the right variant at the call site via overloads:
//! medium picks the stdlib flavour, animated adds the temporal fields + helpers.

import type { JsonObject } from "./json.js";
import type {
  Medium,
  Duration,
  RenderContext,
  OutputInfo,
  AssetMeta,
  AssetDeclaration,
  TemplateConfig,
  TailwindConfig,
  TemplateModule,
} from "./types.js";
import type { ImageStdlib, SvgStdlib, SvgAnimatedStdlib } from "./stdlib.js";
import type { ResolveFn } from "./resolve.js";

// =============================================================================
// STATIC RENDER CONTEXTS (no temporal fields)
// =============================================================================

/** Render context for a static HTML template (`medium:"html"`, no fps/duration). */
export interface ImageRenderContext<TData = JsonObject> {
  std: ImageStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
}

/** Render context for a static SVG template. render() must return SVG markup. */
export interface SvgRenderContext<TData = JsonObject> {
  std: SvgStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  /** Declared duration in seconds — use for CSS animation-duration. */
  duration?: number;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
  output: OutputInfo;
}

/**
 * Render context for an animated SVG template (`medium:"svg"` + fps/duration):
 * the full temporal context, but with the SVG-safe stdlib flavour.
 */
export type SvgAnimatedRenderContext<TData = JsonObject> = Omit<
  RenderContext<TData>,
  "std"
> & { std: SvgAnimatedStdlib };

// =============================================================================
// CONFIG SHAPES FOR OVERLOAD DISCRIMINATION
// =============================================================================

/** A config that makes a template animated: both fps and duration are present. */
export type AnimatedConfig = TemplateConfig & { fps: number; duration: Duration };

/**
 * Animated when `fps` is set and duration will come from `resolve` (or optional static duration).
 * Use with `define({ resolve, config: { fps } })`.
 */
export type ResolveAnimatedConfig = TemplateConfig & { fps: number; duration?: Duration };

/** A static config (no required temporal fields). */
export type StaticConfig = TemplateConfig;

// =============================================================================
// TEMPLATE MODULE NARROWING (animated literal true/false)
// =============================================================================

/** Template module known to be animated (config declares fps + duration). */
export type AnimatedTemplateModule<
  TData = JsonObject,
  M extends Medium = Medium,
> = TemplateModule<TData> & { readonly medium: M; readonly animated: true };

/** Template module known to be static (no fps/duration pair). */
export type StaticTemplateModule<
  TData = JsonObject,
  M extends Medium = Medium,
> = TemplateModule<TData> & { readonly medium: M; readonly animated: false };

// =============================================================================
// define() INPUT — discriminated union (safe to store before calling define())
// =============================================================================

/** SVG template with fps + duration — animated vector output. */
export interface DefineSvgAnimatedInput<TData = JsonObject> {
  medium: "svg";
  config: AnimatedConfig | ResolveAnimatedConfig;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: SvgAnimatedRenderContext<TData>) => string;
}

/** Static SVG template — single-frame vector output. */
export interface DefineSvgStaticInput<TData = JsonObject> {
  medium: "svg";
  config?: StaticConfig;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: SvgRenderContext<TData>) => string;
}

/** HTML template with fps + duration — video / GIF output. */
export interface DefineHtmlAnimatedInput<TData = JsonObject> {
  medium?: "html";
  config: AnimatedConfig | ResolveAnimatedConfig;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: RenderContext<TData>) => string;
}

/** Static HTML template — still image output. */
export interface DefineHtmlStaticInput<TData = JsonObject> {
  medium?: "html";
  config?: StaticConfig;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: ImageRenderContext<TData>) => string;
}

/**
 * Unified `define()` input — mirrors the overload axes without `ctx: never`.
 * Safe to assign to a variable before passing to `define()`.
 */
export type DefineInput<TData = JsonObject> =
  | DefineSvgAnimatedInput<TData>
  | DefineSvgStaticInput<TData>
  | DefineHtmlAnimatedInput<TData>
  | DefineHtmlStaticInput<TData>;

export type { TailwindConfig, AssetDeclaration };

// =============================================================================
// define() — overloads narrow ctx and animated; impl is a typed identity.
// =============================================================================

// 1. SVG + animated (static duration)
export function define<TData, C extends AnimatedConfig = AnimatedConfig>(input: {
  medium: "svg";
  config: C;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: SvgAnimatedRenderContext<TData>) => string;
}): AnimatedTemplateModule<TData, "svg">;

// 1b. SVG + animated via resolve (duration optional at define-time)
export function define<TData>(input: {
  medium: "svg";
  config: ResolveAnimatedConfig;
  sample?: TData;
  resolve: ResolveFn<TData>;
  render: (ctx: SvgAnimatedRenderContext<TData>) => string;
}): AnimatedTemplateModule<TData, "svg">;

// 2. SVG + static
export function define<TData, C extends StaticConfig = StaticConfig>(input: {
  medium: "svg";
  config?: C;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: SvgRenderContext<TData>) => string;
}): StaticTemplateModule<TData, "svg">;

// 3. HTML + animated (static duration)
export function define<TData, C extends AnimatedConfig = AnimatedConfig>(input: {
  medium?: "html";
  config: C;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: RenderContext<TData>) => string;
}): AnimatedTemplateModule<TData, "html">;

// 3b. HTML + animated via resolve (duration optional at define-time)
export function define<TData>(input: {
  medium?: "html";
  config: ResolveAnimatedConfig;
  sample?: TData;
  resolve: ResolveFn<TData>;
  render: (ctx: RenderContext<TData>) => string;
}): AnimatedTemplateModule<TData, "html">;

// 4. HTML + static
export function define<TData, C extends StaticConfig = StaticConfig>(input: {
  medium?: "html";
  config?: C;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: ImageRenderContext<TData>) => string;
}): StaticTemplateModule<TData, "html">;

export function define(input: DefineInput): TemplateModule {
  const medium: Medium = input.medium ?? "html";
  const c = input.config;
  const hasResolve = typeof input.resolve === "function";
  // Animated when fps is set and duration is known now or will be supplied by resolve.
  const animated =
    !!c && typeof c.fps === "number" && (c.duration != null || hasResolve);
  return {
    medium,
    animated,
    render: input.render as TemplateModule["render"],
    ...(input.config !== undefined ? { config: input.config } : {}),
    ...(input.sample !== undefined ? { sample: input.sample } : {}),
    ...(hasResolve ? { resolve: input.resolve } : {}),
  };
}

/** Narrow a template module to animated (fps + duration at authoring time). */
export function isAnimatedTemplate<TData>(
  template: TemplateModule<TData>,
): template is AnimatedTemplateModule<TData> {
  return template.animated === true;
}

/** Narrow a template module to static (still / single-frame). */
export function isStaticTemplate<TData>(
  template: TemplateModule<TData>,
): template is StaticTemplateModule<TData> {
  return template.animated === false;
}