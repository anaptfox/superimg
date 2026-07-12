//! SuperImg Types - Pure TypeScript type definitions
//! Core types, interfaces, and error classes for templates, rendering, and playback

import type { JsonObject } from "./json.js";
import type { TemplateModule } from "./types.js";

/**
 * Any template module. After the `define()` collapse there is a single module
 * shape (medium + animated discriminate behaviour), so this is just an alias —
 * kept for the many call sites that import it.
 */
export type { JsonPrimitive, JsonObject, JsonValue, TemplateData } from "./json.js";
export { isJsonObject } from "./json.js";

export type AnyTemplateModule<TData = JsonObject> = TemplateModule<TData>;

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  // Render Context
  RenderContext,
  Timeline,
  TrackSource,
  OutputInfo,
  CssViewport,

  // Mode Types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  FitMode,

  // Template Types
  Medium,
  TemplateModule,
  TemplateConfig,
  FrameReadinessPolicy,
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
  ComposedTemplateBase,

  RenderOptions,

  // Asset Types
  AssetDeclaration,
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  BackgroundValue,
  AudioValue,
  AudioClip,
  BackgroundOptions,

  // Watermarks
  WatermarkOptions,
  WatermarkValue,

  // Tailwind
  TailwindConfig,
} from "./types.js";

export type {
  AudioRole,
  AudioSource,
  AudioTimeline,
  AudioMixOptions,
  TranscriptWord,
  DocumentaryScript,
  ResolvedAudioClip,
  ResolvedAudioMix,
  ResolvedAudioTimeline,
} from "./audio.js";

export type {
  TimelineModel,
  TimelineTrack,
  TimelineTrackKind,
  TimelineItem,
  VideoTimelineItem,
  AudioTimelineItem,
} from "./timeline-model.js";

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
export { defineConfig } from "./types.js";
export {
  define,
  isAnimatedTemplate,
  isStaticTemplate,
  type ImageRenderContext,
  type SvgRenderContext,
  type SvgAnimatedRenderContext,
  type AnimatedConfig,
  type ResolveAnimatedConfig,
  type StaticConfig,
  type AnimatedTemplateModule,
  type StaticTemplateModule,
  type DefineInput,
  type DefineSvgAnimatedInput,
  type DefineSvgStaticInput,
  type DefineHtmlAnimatedInput,
  type DefineHtmlStaticInput,
} from "./define.js";

export type {
  ResolveInput,
  ResolveResult,
  ResolveFn,
  ResolveMarker,
  ResolvePhaseConfig,
} from "./resolve.js";

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
export {
  isComposedTemplate,
  isComposedSvgTemplate,
  isAnyComposedTemplate,
} from "./player.js";

// =============================================================================
// STDLIB TYPES
// =============================================================================

export type { Stdlib, ImageStdlib, SvgStdlib, SvgAnimatedStdlib } from "./stdlib.js";

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
  RasterizerCapabilities,
  RasterizerConfig,
  Rasterizer,
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
