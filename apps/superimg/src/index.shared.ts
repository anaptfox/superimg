//! SuperImg - Universal exports (works in browser, Node, Bun, Deno)
//! Types, utilities, and state management shared across all environments

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core render context
  RenderContext,
  OutputInfo,
  CssViewport,

  // Branded types
  FrameNumber,
  Progress,
  DurationSeconds,
  DurationFrames,
  TimeSeconds,

  // Mode types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,

  // Template types
  TemplateModule,
  TemplateConfig,

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

// Branded type helpers
export {
  frame,
  progress,
  durationSeconds,
  durationFrames,
  timeSeconds,
} from "@superimg/types";

// Template helpers
export { defineTemplate } from "@superimg/types";

// Error classes
export {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
  PlayerNotReadyError,
} from "@superimg/types";

// =============================================================================
// CORE UTILITIES
// =============================================================================

export {
  createRenderContext,
  compileTemplate,
  validateTemplate,
  CheckpointResolver,
} from "@superimg/core";

// =============================================================================
// PLAYER STATE (shared between browser and server for testing)
// =============================================================================

// Implementation types from the player package (source of truth)
export {
  createPlayerStore,
  formatTime,
} from "@superimg/player";

export type {
  PlayerStore,
  PlayerConfig,
  PlayerState,
  PlayerStoreCallbacks,
} from "@superimg/player";

// User-facing interface types from types package
export type {
  PlayerOptions,
  PlayerEvents,
  PlayerInput,
} from "@superimg/types";
