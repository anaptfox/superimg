//! Engine contract interfaces for pluggable rendering backends

import type {
  TemplateModule,
  AudioValue,
  Duration,
  BackgroundValue,
  RenderContext,
  TailwindConfig,
  AssetMeta,
  WatermarkValue,
} from "./types.js";
import type { ResolvedAudioTimeline } from "./audio.js";
import type { EncodingOptions } from "./encoding-types.js";
import type { JsonObject } from "./json.js";

export interface ResolvedAssetDeclaration {
  key: string;
  type: "image" | "video" | "audio";
  src: string;
  sourceDir: string;
}

/**
 * A Source Map v3 object (structurally typed to avoid pulling source-map-js
 * as a peer dep here). Produced by the bundler, consumed by error enrichment.
 */
export interface TemplateSourceMap {
  version: number;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
  file?: string;
  sourceRoot?: string;
}

/**
 * A bundled template ready for rendering, paired with its sourcemap so
 * runtime / compile errors can be mapped back to the user's original source.
 */
export interface TemplateBundle {
  /** Bundled IIFE code (with optional inline sourcemap comment) */
  code: string;
  /** Parsed sourcemap covering the bundle */
  sourceMap: TemplateSourceMap;
  /** Logical path of the entry source (absolute or virtual) */
  sourceFile: string;
}

export interface RenderJob {
  /** Bundled template + sourcemap. The bundle is consumed by createRenderPlan. */
  templateBundle: TemplateBundle;
  duration: Duration;
  width: number;
  height: number;
  fps: number;
  fonts?: string[];
  /** Global inline CSS to merge with template config */
  inlineCss?: string[];
  /** Global stylesheet URLs to merge with template config */
  stylesheets?: string[];
  /** Enable Tailwind v4 Play CDN */
  tailwind?: boolean | TailwindConfig;
  audio?: AudioValue;
  outputName?: string;
  encoding?: EncodingOptions;
  data?: JsonObject;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
  fps: number;
}

export interface FrameRendererConfig {
  width: number;
  height: number;
  fps?: number;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
  mode?: 'frame' | 'animation';
  /** Headless capture readiness policy from template config. */
  readiness?: import("./types.js").FrameReadinessPolicy;
}

export interface FrameRenderer<TFrame = unknown> {
  init(config: FrameRendererConfig): Promise<void>;
  captureFrame(html: string, options?: { alpha?: boolean; signal?: AbortSignal }): Promise<TFrame>;
  dispose(): Promise<void>;
  /**
   * Optional: Advance the fake clock by `ms` milliseconds before the next capture.
   * Required when mode is 'animation' — implement via page.clock.runFor().
   */
  advanceClock?(ms: number): Promise<void>;
  /**
   * Optional: Preload config.assets and extract metadata.
   * Called before the frame loop. If not implemented, ctx.assets will be empty.
   */
  preloadAssets?(
    declarations: ResolvedAssetDeclaration[]
  ): Promise<Record<string, AssetMeta>>;
}

/**
 * The medium an authored template targets — i.e. which family of rasterizer
 * can turn its markup into pixels.
 *  - "html": full-CSS markup, rasterized by Chromium (Playwright) or the
 *    in-page iframe presenter.
 *  - "svg": vector markup, rasterized by the browser-free resvg-wasm lane
 *    (identical bytes at build time and at the edge).
 */
export type Medium = "html" | "svg";

export interface RasterizerCapabilities {
  /** Which media this rasterizer can turn into pixels. */
  media: ReadonlyArray<Medium>;
  /** True if it needs no browser (resvg-wasm); false for Chromium. */
  browserFree: boolean;
  /** True if it runs inside a Cloudflare Worker / V8 isolate (no node builtins). */
  workerSafe: boolean;
}

export interface RasterizerConfig extends FrameRendererConfig {
  /**
   * Pre-resolved font buffers (woff/ttf bytes). Required by the resvg lane —
   * it cannot fetch Google Fonts CSS the way Chromium does. Ignored by the
   * Playwright rasterizer, which loads fonts via <link> tags.
   */
  fontBuffers?: Uint8Array[];
}

/**
 * A pluggable rasterizer: turns authored markup (HTML or SVG) into a frame.
 * Generalises the (Playwright-coupled) FrameRenderer so rendering location is
 * chosen by `medium` rather than hardcoded. The resvg lane and the Playwright
 * adapter both implement this contract.
 */
export interface Rasterizer<TFrame = unknown> {
  /** Capability descriptor used by the registry to pick a rasterizer by medium. */
  capabilities: RasterizerCapabilities;
  /** True if this rasterizer can render the given medium. */
  accepts(medium: Medium): boolean;
  init(config: RasterizerConfig): Promise<void>;
  /** Rasterize one markup string (HTML or SVG) into a frame. */
  rasterize(markup: string, options?: { alpha?: boolean; signal?: AbortSignal }): Promise<TFrame>;
  dispose(): Promise<void>;
  /**
   * Optional: Advance the fake clock by `ms` milliseconds before the next capture.
   * Required when mode is 'animation' — implement via page.clock.runFor().
   */
  advanceClock?(ms: number): Promise<void>;
  /**
   * Optional: Preload config.assets and extract metadata.
   * Called before the frame loop. If not implemented, ctx.assets will be empty.
   */
  preloadAssets?(
    declarations: ResolvedAssetDeclaration[]
  ): Promise<Record<string, AssetMeta>>;
}

export interface VideoEncoderConfig {
  width: number;
  height: number;
  fps: number;
  encoding?: EncodingOptions;
  audio?: AudioValue;
  /** Pre-resolved clip placements for multi-track mix */
  resolvedAudio?: ResolvedAudioTimeline | null;
}

export interface VideoEncoder<TFrame = unknown> {
  init(config: VideoEncoderConfig): Promise<void>;
  addFrame(frame: TFrame, timestamp: number): Promise<void>;
  finalize(): Promise<Uint8Array>;
  dispose(): Promise<void>;
}

export interface RenderEngine<TFrame = unknown> {
  init(): Promise<void>;
  /** Register a local file for this engine session and return its opaque URL. */
  registerAsset(filePath: string): string;
  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): { renderer: FrameRenderer<TFrame>; encoder: VideoEncoder<TFrame> };
  dispose(): Promise<void>;
}

export interface RenderPlan {
  template: TemplateModule;
  /** The bundle that produced `template` — used to enrich runtime errors with source locations. */
  bundle: TemplateBundle;
  durationSeconds: number; // resolved from Duration via parseDuration
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  /**
   * Which rasterizer family renders this plan. Defaults to "html" when absent
   * (Stage A: optional/additive; Stage B makes it authoritative from `medium`).
   */
  medium?: Medium;
  /** True when the plan renders N frames (fps + duration present). */
  animated?: boolean;
  /** Pre-resolved font buffers for the resvg lane (svg medium only). */
  fontBuffers?: Uint8Array[];
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind?: boolean | TailwindConfig;
  audio?: AudioValue;
  resolvedAudio?: ResolvedAudioTimeline | null;
  outputName: string;
  encoding?: EncodingOptions;
  data?: JsonObject;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
  /** Engine-owned local file registration boundary. */
  assetUrlResolver?: (absolutePath: string) => string;
  /** Template directory for resolving co-located assets */
  templateDir?: string;
  /** Resolved config.assets for preloading */
  resolvedAssets: ResolvedAssetDeclaration[];
  /** Rendering mode — 'frame' (default) or 'animation' (fake clock per frame) */
  mode: 'frame' | 'animation';
  /** First frame to render, inclusive. Default: 0. Used for distributed chunk rendering. */
  startFrame?: number;
  /** Last frame to render, exclusive. Default: totalFrames. Used for distributed chunk rendering. */
  endFrame?: number;
  /**
   * Output of `define({ resolve })` for this plan (phases/markers/meta).
   * Null when the template has no resolve hook.
   */
  resolveResult?: import("./resolve.js").ResolveResult | null;
  /** Headless capture readiness from template config. */
  readiness?: import("./types.js").FrameReadinessPolicy;
}

export interface FramePresenter {
  /** Present a frame - sync for HTML, async for canvas */
  present(html: string, ctx: RenderContext): void | Promise<void>;
  /** Get the presentation target element */
  getElement(): HTMLElement;
  /** Set the logical render size (triggers scale update for CSS-scaled presenters) */
  setLogicalSize?(width: number, height: number): void;
  /** Inject stylesheets and inline CSS (for config.inlineCss/config.stylesheets). Call before first present. */
  injectStyles?(inlineCss?: string[], stylesheets?: string[], tailwind?: boolean | TailwindConfig): void;
  /** Pre-cache fonts/images for faster first render */
  warmup?(): Promise<void>;
  /** Cleanup resources */
  dispose(): void;
}
