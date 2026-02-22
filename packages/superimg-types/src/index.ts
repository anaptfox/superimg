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
  DurationSeconds,
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

  RenderOptions,

  // Encoding Options
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,

  // Asset Types
  BackgroundValue,
  AudioValue,
  BackgroundOptions,
  AudioOptions,
} from "./types.js";

// Branded type helpers
export {
  frame,
  progress,
  durationSeconds,
  durationFrames,
  timeSeconds,
} from "./types.js";

// Template helpers
export { defineTemplate } from "./types.js";

// =============================================================================
// RESULT TYPES & ERRORS
// =============================================================================

export type {
  LoadResult,
  RenderResult,
  RenderBufferResult,
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

export type {
  PlayerOptions,
  PlayerEvents,
  PlayerInput,
} from "./player.js";

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
} from "./engine.js";
