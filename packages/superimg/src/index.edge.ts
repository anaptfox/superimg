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

// Template helpers
export { defineBatch, defineScene, defineImage, defineSvg, defineGif, defineConfig } from "@superimg/types";
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
  TemplateKind,
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
  BackgroundOptions,
  AudioOptions,
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
  ImageModule,
  ImageConfig,
  ImageRenderContext,
  GifModule,
  GifConfig,
  SvgModule,
  SvgConfig,
  SvgRenderContext,
  RenderJob,
  RenderProgress,
  FrameRendererConfig,
  FrameRenderer,
  VideoEncoderConfig,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  FramePresenter,
} from "@superimg/types";
