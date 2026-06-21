//! SuperImg Types - Pure TypeScript type definitions
//! Core types, interfaces, and error classes for templates, rendering, and playback

import type { TemplateModule } from "./types.js";
import type { ImageModule } from "./image-types.js";
import type { GifModule } from "./gif-types.js";
import type { SvgModule } from "./svg-types.js";

export type AnyTemplateModule<TData = Record<string, unknown>> =
  | TemplateModule<TData>
  | ImageModule<TData>
  | GifModule<TData>
  | SvgModule<TData>;

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  // Render Context
  RenderContext,
  OutputInfo,
  CssViewport,

  // Mode Types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,

  // Template Types
  TemplateKind,
  DefineSceneInput,
  TemplateModule,
  TemplateConfig,
  OutputPreset,
  ProjectConfig,
  DeployConfig,
  BaseConfig,

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

  // Asset Types
  AssetDeclaration,
  AssetMeta,
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

export type {
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,
  BitrateMode,
  LatencyMode,
  HardwareAcceleration,
} from "./encoding-types.js";

// Template helpers
export { defineScene, defineConfig } from "./types.js";
export { defineImage, type DefineImageInput, type ImageModule, type ImageConfig, type ImageRenderContext, type ImageOutputPreset, type StillOutputFormat } from "./image-types.js";
export { defineGif, type DefineGifInput, type GifModule, type GifConfig } from "./gif-types.js";
export { defineSvg, type DefineSvgInput, type SvgModule, type SvgConfig, type SvgRenderContext, type SvgOutputPreset } from "./svg-types.js";

// =============================================================================
// RESULT TYPES & ERRORS
// =============================================================================

export type {
  LoadResult,
  RenderResult,
  RenderBufferResult,
  TimeContext,
  SourceLocation,
  SuperImgErrorJSON,
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

export type { Stdlib, ImageStdlib, SvgStdlib } from "./stdlib.js";

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
  TemplateBundle,
  TemplateSourceMap,
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

// =============================================================================
// BUILD INTEGRATION EVENTS
// =============================================================================

export { RENDER_EVENT_VERSION } from "./events.js";
export type { RenderEvent } from "./events.js";

// =============================================================================
// BATCH TYPES
// =============================================================================

export { defineBatch, type BatchEntry, type BatchProvider } from "./batch-types.js";
