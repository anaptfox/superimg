//! SuperImg - Template and core SDK exports

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core render context
  RenderContext,
  OutputInfo,
  CssViewport,

  // Mode types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,

  // Template types
  Medium,
  AnyTemplateModule,
  TemplateModule,
  AnimatedTemplateModule,
  StaticTemplateModule,
  DefineInput,
  TemplateConfig,
  ProjectConfig,

  // Scene composition
  Duration,
  Transition,
  TransitionType,
  SceneDefinition,
  ResolvedScene,
  ResolvedTransition,
  ComposedTemplate,


  RenderOptions,

  // Encoding options
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,

  // Asset types
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  BackgroundValue,
  AudioValue,
  AudioClip,
  AudioTimeline,
  ResolvedAudioTimeline,
  BackgroundOptions,

  // Result types
  LoadResult,
  RenderResult,
  RenderBufferResult,

  // Checkpoint types
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,

  // Batch types
  BatchEntry,
  BatchProvider,

  // Compiler types
  CompileError,
  CompileResult,

  // Stdlib type
  Stdlib,
  ImageStdlib,
  SvgStdlib,
  SvgAnimatedStdlib,

  // Render contexts (static / svg / animated-svg)
  ImageRenderContext,
  SvgRenderContext,
  SvgAnimatedRenderContext,

} from "@superimg/types";

// Template authoring helpers. Keep the root runtime graph intentionally small;
// operational APIs belong to explicit server/browser/edge subpaths.
export {
  define,
  defineConfig,
  defineBatch,
  compose,
  scene,
  layoutTimeline,
} from "@superimg/core/template-runtime";

export {
  isAnimatedTemplate,
  isStaticTemplate,
  isComposedTemplate,
  isAnyComposedTemplate,
} from "@superimg/types";

// Error classes
export {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
} from "@superimg/types";
