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
  TemplateModule,
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
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,

  // Asset types
  BackgroundValue,
  AudioValue,
  BackgroundOptions,
  AudioOptions,

  // Result types
  LoadResult,
  RenderResult,
  RenderBufferResult,

  // Checkpoint types
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,

  // Compiler types
  CompileError,
  CompileResult,

  // Stdlib type
  Stdlib,

  // Engine contract types
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

// Template helpers
export { defineScene, defineConfig } from "@superimg/types";

// Error classes
export {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
} from "@superimg/types";

// =============================================================================
// CORE UTILITIES
// =============================================================================

export {
  createRenderContext,
  compileTemplate,
  validateTemplate,
  CheckpointResolver,
  compose,
  scene,
  transitions,
  parseDuration,
} from "@superimg/core";
export { buildCompositeHtml } from "@superimg/core/html";
export { isComposedTemplate } from "@superimg/types";
