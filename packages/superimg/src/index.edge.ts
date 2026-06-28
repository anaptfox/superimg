//! SuperImg Edge Entrypoint — full worker surface
//! Safe to import from Cloudflare Workers, V8 Isolates, Deno.
//! Zero Playwright, zero DOM dependencies.

export { renderToHtml, renderNativeToHtml, type NativeRenderOptions } from "@superimg/core";

// Core utilities (pure, no node: at module load)
export {
  createRenderContext,
  createImageRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
  compileTemplate,
  validateTemplate,
  CheckpointResolver,
  compose,
  scene,
  transitions,
  parseDuration,
} from "@superimg/core";
export { buildCompositeHtml } from "@superimg/core/html";

// Browser-free SVG rasterization (resvg-wasm) + font registry — the edge image lane
export {
  rasterize,
  rasterizeSvgSync,
  ensureInit,
  ResvgRasterizer,
  fonts,
  resolveFontBuffers,
  selectRasterizer,
  type RasterizeSvgOptions,
  type ResolvedFont,
  type FontRegistry,
  type WasmSource,
  type RasterizerRegistryOptions,
} from "@superimg/core";

// Template helpers
export { defineBatch, define, defineConfig } from "@superimg/types";
export { isComposedTemplate } from "@superimg/types";

// Error classes
export {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
} from "@superimg/types";

// Types
export type {
  RenderContext,
  OutputInfo,
  CssViewport,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,
  Medium,
  AnyTemplateModule,
  TemplateModule,
  TemplateConfig,
  ProjectConfig,
  Duration,
  Transition,
  TransitionType,
  SceneDefinition,
  ResolvedScene,
  ResolvedTransition,
  ComposedTemplate,
  RenderOptions,
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,
  BackgroundValue,
  AudioValue,
  AudioClip,
  AudioTimeline,
  ResolvedAudioTimeline,
  BackgroundOptions,
  LoadResult,
  RenderResult,
  RenderBufferResult,
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,
  BatchEntry,
  BatchProvider,
  CompileError,
  CompileResult,
  Stdlib,
  ImageStdlib,
  SvgStdlib,
  SvgAnimatedStdlib,
  ImageRenderContext,
  SvgRenderContext,
  SvgAnimatedRenderContext,
  RenderJob,
  RenderProgress,
  FrameRendererConfig,
  FrameRenderer,
  Rasterizer,
  RasterizerCapabilities,
  RasterizerConfig,
  VideoEncoderConfig,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  FramePresenter,
} from "@superimg/types";
