//! SuperImg Types - Pure TypeScript type definitions
//! Core types, interfaces, and error classes for templates, rendering, and playback

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  // Render Context
  RenderContext,
  OutputInfo,
  CssViewport,

  // Branded Types
  FrameNumber,
  Progress,
  DurationFrames,
  TimeSeconds,

  // Mode Types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,

  // Template Types
  TemplateModule,
  TemplateConfig,
  OutputPreset,
  ProjectConfig,

  // Scene Composition
  Duration,
  TransitionType,
  EasingName,
  Transition,
  SceneDefinition,
  ResolvedTransition,
  ResolvedScene,
  ComposedTemplate,

  RenderOptions,

  // Encoding Options
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,
  BitrateMode,
  LatencyMode,
  HardwareAcceleration,

  // Asset Types
  AssetRef,
  AssetDeclaration,
  AssetMeta,
  AssetMetaBase,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  BackgroundValue,
  AudioValue,
  BackgroundOptions,
  AudioOptions,

  // Watermarks
  WatermarkOptions,
  WatermarkValue,

  // Tailwind
  TailwindConfig,
} from "./types.js";

// Branded type helpers
export {
  frame,
  progress,
  durationFrames,
  timeSeconds,
} from "./types.js";

// Template helpers
export { defineScene, defineConfig } from "./types.js";
export { ProjectConfigSchema } from "./project-config-schema.js";

// =============================================================================
// RESULT TYPES & ERRORS
// =============================================================================

export type {
  LoadResult,
  RenderResult,
  RenderBufferResult,
  TimeContext,
} from "./results.js";

export {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
  PlayerNotReadyError,
} from "./results.js";

// =============================================================================
// PLAYER TYPES (user-facing interfaces only)
// Implementation types (PlayerState, PlayerStore, etc.) are in @superimg/player
// =============================================================================

export type { PlayerOptions, PlayerEvents, PlayerInput } from "./player.js";
export { isComposedTemplate } from "./player.js";

// =============================================================================
// STDLIB TYPES
// =============================================================================

export type { Stdlib } from "./stdlib.js";

// =============================================================================
// CHECKPOINT TYPES
// =============================================================================

export type {
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,
} from "./checkpoint.js";

// =============================================================================
// COMPILER TYPES (internal)
// =============================================================================

export type {
  CompileResult,
  CompileError,
} from "./compiler.js";

// =============================================================================
// ENGINE CONTRACTS
// =============================================================================

export type {
  RenderJob,
  RenderProgress,
  FrameRendererConfig,
  FrameRenderer,
  VideoEncoderConfig,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  FramePresenter,
  ResolvedAssetDeclaration,
} from "./engine.js";

// =============================================================================
// VALIDATION TYPES (for AI-generated templates)
// =============================================================================

export type {
  ValidationErrorCode,
  ValidationIssue,
  ValidationResult,
  ValidationOptions,
} from "./validation.js";
