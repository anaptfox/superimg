//! Canonical deterministic media definitions and authoring helpers.
//!
//! `video()`, `image()`, `svg()`, and `ogImage()` are the concise authoring
//! surface. They all lower to the same `MediaDefinition` returned by `define()`.
//! Delivery destinations and file paths are deliberately absent from this layer.

import type { FontInput } from "./fonts.js";
import type { JsonObject } from "./json.js";
import type { RenderOutput } from "./media-node.js";
import type {
  Medium,
  Duration,
  RenderContext,
  AssetMeta,
  AssetDeclaration,
  TemplateConfig,
  TailwindConfig,
  TemplateModule,
  TemporalMode,
  FrameReadinessPolicy,
  BackgroundValue,
  WatermarkValue,
} from "./types.js";
import type { AudioValue } from "./audio.js";
import type { ImageStdlib, SvgStdlib, SvgAnimatedStdlib } from "./stdlib.js";
import type { ResolveFn } from "./resolve.js";
import type { RetainedComposition } from "./composition.js";

/** Pixel dimensions owned by the authored media, independent of delivery. */
export interface CanvasSize {
  width: number;
  height: number;
}

export type DeterministicMediaKind = "video" | "image" | "svg";

export type DefaultMediaFormat<TKind extends DeterministicMediaKind> =
  TKind extends "video" ? "mp4"
  : TKind extends "svg" ? "svg"
  : "png";

/** Render context for a static HTML definition. */
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
}

/** Render context for a static SVG definition. */
export interface SvgRenderContext<TData = JsonObject> {
  std: SvgStdlib;
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
  duration?: number;
  data: TData;
  assets: Record<string, AssetMeta>;
  asset: (filename: string) => string;
}

/** Animated SVG remains available through the lower-level `define()` API. */
export type SvgAnimatedRenderContext<TData = JsonObject> = Omit<
  RenderContext<TData>,
  "std"
> & { std: SvgAnimatedStdlib };

/** A responsive art-direction override for one exact canvas. */
export interface MediaEdition<TData, TContext> {
  size: CanvasSize;
  render?: (ctx: TContext) => RenderOutput;
}

type ReservedVariantField =
  | "width"
  | "height"
  | "size"
  | "fps"
  | "duration"
  | "temporal"
  | "format"
  | "codec"
  | "path"
  | "filename";

/** A root-level shallow patch to data. Arrays and nested values replace. */
export type MediaVariantPatch<TData> = Partial<TData> & {
  readonly [K in ReservedVariantField]?: never;
};

export type MediaEditions<TData, TContext> = Readonly<
  Record<string, MediaEdition<TData, TContext>>
>;

export type MediaVariants<TData> = Readonly<
  Record<string, MediaVariantPatch<TData>>
>;

interface DefinitionExtras<TData, TContext> {
  editions?: MediaEditions<TData, TContext>;
  variants?: MediaVariants<TData>;
}

/**
 * The one canonical deterministic authoring value understood by compilers,
 * players, collections, and adapters.
 */
export type MediaDefinition<
  TData = JsonObject,
  TKind extends DeterministicMediaKind = DeterministicMediaKind,
  TContext = RenderContext<TData>,
> = Omit<TemplateModule<TData>, "render"> &
  DefinitionExtras<TData, TContext> & {
    readonly kind: "media";
    readonly media: TKind;
    /** Format used only when no destination or custom rendition is requested. */
    readonly fallbackFormat: DefaultMediaFormat<TKind>;
    /** Authored frame time used only when an export explicitly requests a poster. */
    readonly poster?: Duration;
    /** Retained authored structure for a projected composition. */
    readonly composition?: RetainedComposition;
    render: (ctx: TContext) => RenderOutput;
  };

export type VideoDefinition<TData = JsonObject> = MediaDefinition<
  TData,
  "video",
  RenderContext<TData>
> & { readonly animated: true; readonly medium: "html" };

export type ImageDefinition<TData = JsonObject> = MediaDefinition<
  TData,
  "image",
  ImageRenderContext<TData>
> & { readonly animated: false; readonly medium: "html" };

export type SvgDefinition<TData = JsonObject> = MediaDefinition<
  TData,
  "svg",
  SvgRenderContext<TData>
> & { readonly animated: false; readonly medium: "svg" };

export type DeterministicMediaDefinition<TData = unknown> =
  | MediaDefinition<TData, "video", RenderContext<TData>>
  | MediaDefinition<TData, "image", ImageRenderContext<TData>>
  | MediaDefinition<TData, "svg", SvgRenderContext<TData>>
  | MediaDefinition<TData, "svg", SvgAnimatedRenderContext<TData>>;

/** A config that makes a definition animated. */
export type AnimatedConfig = TemplateConfig & { fps: number; duration: Duration };

/** Animated when duration is supplied by `resolve()`. */
export type ResolveAnimatedConfig = TemplateConfig & {
  fps: number;
  duration?: Duration;
};

export type StaticConfig = TemplateConfig;

export type AnimatedTemplateModule<
  TData = JsonObject,
  M extends Medium = Medium,
> = MediaDefinition<
  TData,
  M extends "svg" ? "svg" : "video",
  M extends "svg" ? SvgAnimatedRenderContext<TData> : RenderContext<TData>
> & {
  readonly medium: M;
  readonly animated: true;
};

export type StaticTemplateModule<
  TData = JsonObject,
  M extends Medium = Medium,
> = MediaDefinition<
  TData,
  M extends "svg" ? "svg" : "image",
  M extends "svg" ? SvgRenderContext<TData> : ImageRenderContext<TData>
> & {
  readonly medium: M;
  readonly animated: false;
};

interface DefineShared<TData, TContext> extends DefinitionExtras<TData, TContext> {
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: TContext) => RenderOutput;
}

export interface DefineSvgAnimatedInput<TData = JsonObject>
  extends DefineShared<TData, SvgAnimatedRenderContext<TData>> {
  medium: "svg";
  config: AnimatedConfig | ResolveAnimatedConfig;
  poster?: Duration;
}

export interface DefineSvgStaticInput<TData = JsonObject>
  extends DefineShared<TData, SvgRenderContext<TData>> {
  medium: "svg";
  config?: StaticConfig;
  poster?: never;
}

export interface DefineHtmlAnimatedInput<TData = JsonObject>
  extends DefineShared<TData, RenderContext<TData>> {
  medium?: "html";
  config: AnimatedConfig | ResolveAnimatedConfig;
  poster?: Duration;
}

export interface DefineHtmlStaticInput<TData = JsonObject>
  extends DefineShared<TData, ImageRenderContext<TData>> {
  medium?: "html";
  config?: StaticConfig;
  poster?: never;
}

export type DefineInput<TData = JsonObject> =
  | DefineSvgAnimatedInput<TData>
  | DefineSvgStaticInput<TData>
  | DefineHtmlAnimatedInput<TData>
  | DefineHtmlStaticInput<TData>;

export type { TailwindConfig, AssetDeclaration };

export function define<TData>(
  input: DefineSvgAnimatedInput<TData> & { resolve: ResolveFn<TData> },
): AnimatedTemplateModule<TData, "svg">;
export function define<TData>(
  input: DefineSvgAnimatedInput<TData>,
): AnimatedTemplateModule<TData, "svg">;
export function define<TData>(
  input: DefineSvgStaticInput<TData>,
): StaticTemplateModule<TData, "svg">;
export function define<TData>(
  input: DefineHtmlAnimatedInput<TData> & { resolve: ResolveFn<TData> },
): AnimatedTemplateModule<TData, "html">;
export function define<TData>(
  input: DefineHtmlAnimatedInput<TData>,
): AnimatedTemplateModule<TData, "html">;
export function define<TData>(
  input: DefineHtmlStaticInput<TData>,
): StaticTemplateModule<TData, "html">;
export function define<TData>(input: DefineInput<TData>): MediaDefinition<TData>;

export function define(input: DefineInput): MediaDefinition {
  const medium: Medium = input.medium ?? "html";
  const config = input.config;
  const hasResolve = typeof input.resolve === "function";
  const animated =
    !!config &&
    typeof config.fps === "number" &&
    (config.duration != null || hasResolve);
  return {
    kind: "media",
    media: medium === "svg" ? "svg" : animated ? "video" : "image",
    fallbackFormat: medium === "svg" ? "svg" : animated ? "mp4" : "png",
    medium,
    animated,
    render: input.render as MediaDefinition["render"],
    ...(config !== undefined ? { config } : {}),
    ...(input.sample !== undefined ? { sample: input.sample } : {}),
    ...(input.resolve !== undefined ? { resolve: input.resolve } : {}),
    ...(input.editions !== undefined ? { editions: input.editions } : {}),
    ...(input.variants !== undefined ? { variants: input.variants } : {}),
    ...("poster" in input && input.poster !== undefined ? { poster: input.poster } : {}),
  };
}

interface SharedRecipe<TData, TContext> extends DefinitionExtras<TData, TContext> {
  nativeModuleSets?: TemplateConfig["nativeModuleSets"];
  size?: CanvasSize;
  sample?: TData;
  resolve?: ResolveFn<TData>;
  render: (ctx: TContext) => RenderOutput;
  fonts?: readonly FontInput[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
  readiness?: FrameReadinessPolicy;
  assets?: Record<string, AssetDeclaration>;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
  audio?: AudioValue;
}

export interface VideoInput<TData = JsonObject>
  extends SharedRecipe<TData, RenderContext<TData>> {
  duration: Duration;
  fps?: number;
  temporal?: TemporalMode;
  poster?: Duration;
}

export interface ImageInput<TData = JsonObject>
  extends SharedRecipe<TData, ImageRenderContext<TData>> {}

export interface SvgInput<TData = JsonObject>
  extends SharedRecipe<TData, SvgRenderContext<TData>> {}

function recipeConfig(
  input: SharedRecipe<unknown, unknown>,
  defaults: CanvasSize,
): TemplateConfig {
  const size = input.size ?? defaults;
  return {
    width: size.width,
    height: size.height,
    ...(input.fonts !== undefined ? { fonts: input.fonts } : {}),
    ...(input.inlineCss !== undefined ? { inlineCss: input.inlineCss } : {}),
    ...(input.stylesheets !== undefined ? { stylesheets: input.stylesheets } : {}),
    ...(input.tailwind !== undefined ? { tailwind: input.tailwind } : {}),
    ...(input.readiness !== undefined ? { readiness: input.readiness } : {}),
    ...(input.assets !== undefined ? { assets: input.assets } : {}),
    ...(input.nativeModuleSets !== undefined ? { nativeModuleSets: input.nativeModuleSets } : {}),
    ...(input.background !== undefined ? { background: input.background } : {}),
    ...(input.watermark !== undefined ? { watermark: input.watermark } : {}),
    ...(input.audio !== undefined ? { audio: input.audio } : {}),
  };
}

/** Concise animated-media recipe. Defaults to 1920x1080 at 30 fps. */
export function video<TData = JsonObject>(input: VideoInput<TData>): VideoDefinition<TData> {
  const config = {
    ...recipeConfig(input as SharedRecipe<unknown, unknown>, { width: 1920, height: 1080 }),
    fps: input.fps ?? 30,
    duration: input.duration,
    temporal: input.temporal ?? "once",
  } satisfies AnimatedConfig;
  return define({ ...input, medium: "html", config }) as VideoDefinition<TData>;
}

/** Concise raster still recipe. Defaults to 1920x1080. */
export function image<TData = JsonObject>(input: ImageInput<TData>): ImageDefinition<TData> {
  const config = recipeConfig(
    input as SharedRecipe<unknown, unknown>,
    { width: 1920, height: 1080 },
  );
  return define({ ...input, medium: "html", config }) as ImageDefinition<TData>;
}

/** Concise vector still recipe. Defaults to 1920x1080. */
export function svg<TData = JsonObject>(input: SvgInput<TData>): SvgDefinition<TData> {
  const config = recipeConfig(
    input as SharedRecipe<unknown, unknown>,
    { width: 1920, height: 1080 },
  );
  return define({ ...input, medium: "svg", config }) as SvgDefinition<TData>;
}

/** Open Graph still recipe. Defaults to 1200x630. */
export function ogImage<TData = JsonObject>(input: ImageInput<TData>): ImageDefinition<TData> {
  const config = recipeConfig(
    input as SharedRecipe<unknown, unknown>,
    { width: 1200, height: 630 },
  );
  return define({ ...input, medium: "html", config }) as ImageDefinition<TData>;
}

export function isAnimatedTemplate<TData>(
  media: MediaDefinition<TData>,
): media is AnimatedTemplateModule<TData> {
  return media.animated === true;
}

export function isStaticTemplate<TData>(
  media: MediaDefinition<TData>,
): media is StaticTemplateModule<TData> {
  return media.animated === false;
}
