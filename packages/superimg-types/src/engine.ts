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
import type { FontInput } from "./fonts.js";
import type { JsonObject } from "./json.js";
import type { MediaCoordinates } from "./coordinates.js";

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
  /** Resolved local compiler inputs, including imports removed by tree shaking. */
  dependencies?: readonly string[];
  /** Host-owned identity of the compiled bytes served to a preview. */
  source?: Readonly<{ id: string; revision: string }>;
  /** Common immutable entry/module inputs, independent of output format. */
  inputIdentity?: string;
  /** Browser-safe entry projection; never identifies provider execution. */
  projectionIdentity?: string;
  /** Hash of the exact emitted code, including selection and format. */
  outputIdentity?: string;
  /** All files emitted by the compiler. Hosts must publish the complete set. */
  outputs?: readonly ({ readonly type: "chunk"; readonly fileName: string; readonly code: string; readonly isEntry: boolean; readonly sourceMap: TemplateSourceMap } | { readonly type: "asset"; readonly fileName: string; readonly source: string | Uint8Array })[];
  /** Hash of the complete emitted file set, including companion chunks and maps. */
  outputSetIdentity?: string;
  /** Native closures owned by the host, separate from the media entry code. */
  nativeModuleSets?: readonly PreparedNativeModuleSet[];
  diagnostics?: readonly CompilerDiagnostic[];
}

/** A host-prepared browser module closure, addressed by its emitted bytes. */
export interface PreparedNativeModuleSet {
  readonly identity: string;
  readonly outputs: NonNullable<TemplateBundle["outputs"]>;
}

export interface CompilerDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly stage: "source" | "resolve" | "transform" | "generate" | "evaluate";
  readonly message: string;
  readonly file?: string;
  /** UTF-16 source offsets, compatible with JavaScript strings and editors. */
  readonly labels?: readonly { readonly start: number; readonly end: number; readonly message?: string }[];
  /** One-based line and zero-based UTF-16 column. */
  readonly line?: number;
  readonly column?: number;
  readonly help?: string;
  readonly plugin?: string;
  readonly inputIdentity?: string;
}

export interface RenderJob {
  /** Bundled template + sourcemap. The bundle is consumed by createRenderPlan. */
  templateBundle: TemplateBundle;
  duration: Duration;
  width: number;
  height: number;
  fps: number;
  fonts?: readonly FontInput[];
  /** Global inline CSS to merge with template config */
  inlineCss?: string[];
  /** Global stylesheet URLs to merge with template config */
  stylesheets?: string[];
  /** Enable Tailwind v4 Play CDN */
  tailwind?: boolean | TailwindConfig;
  audio?: AudioValue;
  coordinates?: MediaCoordinates;
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

export interface FrameCaptureOptions {
  /** Host-only observations; never serialized into media. */
  onTiming?: (event: { stage: string; durationMs: number; status: "completed" | "failed"; clock: "local-monotonic" }) => void;
  onDiagnostics?: (event: JsonObject) => void;
  alpha?: boolean;
  signal?: AbortSignal;
  /**
   * Intermediate screenshot codec. When omitted, renderer uses
   * encoding.capture / format-aware defaults.
   */
  intermediate?: "png" | "jpeg";
  jpegQuality?: number;
  /** Playwright screenshot scale: css viewport vs device pixels. */
  scale?: "css" | "device";
  /** Exact animation time in seconds (`frame / fps`), including reverse seeks. */
  time?: number;
}

export interface RasterizerConfig {
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
  /**
   * deviceScaleFactor for the browser context / rasterizer.
   * Prefer setting at context creation; default 1 for video, 2 for stills.
   */
  dpr?: number;
  /** Capture fidelity defaults for this job. */
  capture?: import("./encoding-types.js").CaptureOptions;
  /** Output format (drives capture intermediate defaults). */
  format?: import("./encoding-types.js").OutputFormat;
  /**
   * Pre-resolved font buffers (woff/ttf bytes). Required by the resvg lane —
   * it cannot fetch Google Fonts CSS the way Chromium does. Ignored by the
   * Playwright rasterizer, which loads fonts via <link> tags.
   */
  fontBuffers?: Uint8Array[];
  /**
   * Named faces for Blitz/Parley. Prefer this over `fontBuffers` so CSS
   * `font-family` matches the registered family.
   */
  resolvedFonts?: ResolvedFontFace[];
  /** Trusted, host-prepared browser module closures for this capture lease. */
  nativeModuleSets?: readonly PreparedNativeModuleSet[];
}

/**
 * The medium an authored template targets — i.e. which family of rasterizer
 * can turn its markup into pixels.
 */
export type Medium = "html" | "svg";

export interface RasterizerCapabilities {
  readonly media: ReadonlyArray<Medium>;
  readonly browserFree: boolean;
  readonly workerSafe: boolean;
}

/** A named face with bytes for native/vector rasterizers. */
export interface ResolvedFontFace {
  family: string;
  weight: number;
  style: "normal" | "italic";
  data: Uint8Array;
}

/**
 * A pluggable rasterizer: turns authored markup (HTML or SVG) into a frame.
 * Rendering location is selected by `medium`; every backend implements this
 * single contract.
 */
export interface Rasterizer<TFrame = unknown> {
  /** Capability descriptor used by the registry to pick a rasterizer by medium. */
  capabilities?: RasterizerCapabilities;
  /** True if this rasterizer can render the given medium. */
  accepts?(medium: Medium): boolean;
  init(config: RasterizerConfig): Promise<void>;
  /** Rasterize one markup string at an absolute media time. */
  rasterize(markup: string, options?: FrameCaptureOptions): Promise<TFrame>;
  dispose(): Promise<void>;
  /**
   * Optional: Preload config.assets and extract metadata.
   * Called before the frame loop. If not implemented, ctx.assets will be empty.
   */
  preloadAssets?(
    declarations: ResolvedAssetDeclaration[]
  ): Promise<Record<string, AssetMeta>>;
}

/** Observable selected encoding policy. Unknown native details stay absent. */
export interface VideoEncoderDiagnostics {
  readonly codec: string;
  readonly codecString?: string;
  readonly width: number;
  readonly height: number;
  readonly rateControl?: "constant" | "variable" | "quantizer";
  readonly hardwarePreference?: import("./encoding-types.js").HardwareAcceleration;
  readonly inputPixelFormat?: "RGBA";
  readonly implementation?: string;
  readonly pixelFormat?: string;
}

export interface EncodedFileResult {
  readonly path: string;
  readonly byteLength: number;
}

export interface VideoEncoderConfig {
  width: number;
  height: number;
  fps: number;
  /** Exact output duration, used to interleave authored audio with video. */
  durationSeconds?: number;
  encoding?: EncodingOptions;
  audio?: AudioValue;
  /** Pre-resolved clip placements for multi-track mix */
  resolvedAudio?: ResolvedAudioTimeline | null;
  /** Node hosts may supply a private, seekable output file instead of buffering. */
  output?: Readonly<{ kind: "file"; path: string }>;
  /** Observation only: a callback failure must not change encoding. */
  onDiagnostics?: (diagnostics: VideoEncoderDiagnostics) => void;
}

export interface VideoEncoder<TFrame = unknown> {
  init(config: VideoEncoderConfig): Promise<void>;
  addFrame(frame: TFrame, timestamp: number): Promise<void>;
  finalize(): Promise<Uint8Array>;
  /** Finalize file mode without reading the movie into memory. */
  finalizeToFile?(): Promise<EncodedFileResult>;
  dispose(): Promise<void>;
}

export interface RenderEngine<TFrame = unknown> {
  init(): Promise<void>;
  /** Register a local file for this engine session and return its opaque URL. */
  registerAsset(filePath: string): string;
  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): { renderer: Rasterizer<TFrame>; encoder: VideoEncoder<TFrame> };
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
  /** Named faces for Blitz (and resvg). Same fetch as `fontBuffers`. */
  resolvedFonts?: ResolvedFontFace[];
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind?: boolean | TailwindConfig;
  audio?: AudioValue;
  resolvedAudio?: ResolvedAudioTimeline | null;
  coordinates: MediaCoordinates;
  encoding?: EncodingOptions;
  data?: JsonObject;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
  /** Host-resolved lookup used by `ctx.asset(name)`. */
  assetResolver?: (name: string) => string;
  /** Resolved config.assets for preloading */
  resolvedAssets: ResolvedAssetDeclaration[];
  /** Rendering mode — per-frame or exact-time CSS/Web Animation sampling. */
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
