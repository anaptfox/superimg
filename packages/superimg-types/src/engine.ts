//! Engine contract interfaces for pluggable rendering backends

import type {
  TemplateModule,
  AudioValue,
  EncodingOptions,
  BackgroundValue,
  RenderContext,
  TailwindConfig,
  AssetMeta,
} from "./types.js";

/** Resolved asset declaration for preloading (from @superimg/core) */
export interface ResolvedAssetDeclaration {
  key: string;
  type: "image" | "video" | "audio";
  src: string;
}

export interface RenderJob {
  templateCode: string;
  durationSeconds: number;
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
  data?: Record<string, unknown>;
  background?: BackgroundValue;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
  fps: number;
}

export interface FrameRendererConfig {
  width: number;
  height: number;
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
  tailwind?: boolean | TailwindConfig;
}

export interface FrameRenderer<TFrame = unknown> {
  init(config: FrameRendererConfig): Promise<void>;
  captureFrame(html: string, options?: { alpha?: boolean }): Promise<TFrame>;
  dispose(): Promise<void>;
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
}

export interface VideoEncoder<TFrame = unknown> {
  init(config: VideoEncoderConfig): Promise<void>;
  addFrame(frame: TFrame, timestamp: number): Promise<void>;
  finalize(): Promise<Uint8Array>;
  dispose(): Promise<void>;
}

export interface RenderEngine<TFrame = unknown> {
  init(): Promise<void>;
  createAdapters(): { renderer: FrameRenderer<TFrame>; encoder: VideoEncoder<TFrame> };
  dispose(): Promise<void>;
}

export interface RenderPlan {
  template: TemplateModule;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind?: boolean | TailwindConfig;
  audio?: AudioValue;
  outputName: string;
  encoding?: EncodingOptions;
  data?: Record<string, unknown>;
  background?: BackgroundValue;
  /** Resolved config.assets for preloading */
  resolvedAssets: ResolvedAssetDeclaration[];
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
