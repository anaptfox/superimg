//! SuperImg Types - Pure TypeScript type definitions
//! Core types, interfaces, and error classes for templates, rendering, and playback

import type { JsonObject } from "./json.js";
import type { TemplateModule } from "./types.js";
export type { NativeSurfaceHost, NativeSurfaceFrame, NativeSurfaceInstance, NativeSurfaceModule } from "./native-surface.js";

/** Runtime view of a deterministic media module. */
export type {
  JsonPrimitive,
  JsonObject,
  JsonValue,
  JsonCompatible,
  TemplateData,
} from "./json.js";
export { isJsonObject } from "./json.js";
export type {
  ReviewPlan,
  ReviewBeat,
  ReviewCheck,
  ReviewObservationContext,
} from "./review.js";

export type {
  Program,
  CompositionFit,
  CompositionMedia,
  CompositionContent,
  InteractiveCompositionChild,
  InteractiveCompositionRuntime,
  Use,
  SequenceProgram,
  TogetherProgram,
  PlacedUse,
  CompositionPlacement,
  ChooseProgram,
  CompositionLeafSchedule,
  CompositionSchedule,
  RetainedComposition,
  CompositionEntryData,
} from "./composition.js";

export type AnyTemplateModule<TData = JsonObject> = TemplateModule<TData>;

export {
  MEDIA_ELEMENT,
  isMediaElement,
  isRenderOutput,
} from "./media-node.js";
export type {
  MediaLayout,
  MediaStylePropertyValue,
  MediaStyleObject,
  MediaMotionValue,
  MediaStyleValue,
  MediaProps,
  MediaAttributes,
  MediaChild,
  MediaElement,
  MediaNode,
  RenderOutput,
} from "./media-node.js";

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  // Render Context
  RenderContext,
  Timeline,
  TrackSource,
  CssViewport,

  // Mode Types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  DriveSource,
  FitMode,

  // Template Types
  Medium,
  TemplateModule,
  TemplateConfig,
  FrameReadinessPolicy,
  TemporalMode,
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

  RenderOptions,

  // Asset Types
  AssetDeclaration,
  AssetKind,
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
  NarrationSegmentTiming, MeasuredNarrationSegment, NarrationTimingOptions,
  NarrationPlanSegment, NarrationFinding, NarrationPlan,
} from "./narration.js";



export type {
  EncodingOptions,
  CaptureOptions,
  StillEncodeOptions,
  StillDebandMode,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,
  BitrateMode,
  LatencyMode,
  HardwareAcceleration,
  EncodingQuality,
} from "./encoding-types.js";
export {
  isStillOutputFormat,
  resolveCaptureDefaults,
  resolveCaptureRegion,
  normalizeEncodingQuality,
  isAlphaCodecContainerCompatible,
  PRORES_MASTER_ENCODING,
  PRORES_MASTER_ALPHA_ENCODING,
} from "./encoding-types.js";
export type {
  MediaInput,
  MediaTrackInspection,
  MediaInspection,
  MediaInspectOptions,
  MediaTrim,
  NormalizedMediaTrim,
  ConversionTrackSelection,
  ConversionVideoSelection,
  ConversionCopyOptions,
  ConversionSource,
  ConversionRequest,
  ConversionArtifact,
  ConversionTrackPlan,
} from "./media.js";
export { mediaTrackId, normalizeTrim, normalizeConversionCopy, resolveMediaTrackId, selectMediaTrack } from "./media.js";
export type { JobState, JobEvent, PausableJob } from "./job.js";
export type {
  CortexStockViewId,
  EditorialIntent,
  EditorialAudience,
  EditorialBrief,
  VisualAtomKind,
  VisualAtom,
  CortexAssetKind,
  CortexAssetRef,
  CortexEvidenceRef,
  CortexCustomPayload,
  CortexBundle,
  CortexArtifactRecord,
} from "./cortex.js";
export {
  CORTEX_STOCK_VIEWS,
  EDITORIAL_INTENTS,
  EDITORIAL_AUDIENCES,
  VISUAL_ATOM_KINDS,
  CORTEX_ASSET_KINDS,
  CortexBundleError,
  isCortexStockViewId,
  atomKinds,
  parseCortexBundle,
} from "./cortex.js";

export type {
  FontSource,
  FontDeclaration,
  GoogleFontDeclaration,
  FontInput,
} from "./fonts.js";
export {
  googleFont,
  isGoogleFontDeclaration,
  isFontDeclaration,
  fontDeclarationIssue,
} from "./fonts.js";

// Template helpers
export { defineConfig } from "./types.js";
export {
  define,
  video,
  image,
  svg,
  ogImage,
  isAnimatedTemplate,
  isStaticTemplate,
  type CanvasSize,
  type DeterministicMediaKind,
  type DefaultMediaFormat,
  type MediaEdition,
  type MediaEditions,
  type MediaVariantPatch,
  type MediaVariants,
  type MediaDefinition,
  type DeterministicMediaDefinition,
  type VideoDefinition,
  type ImageDefinition,
  type SvgDefinition,
  type VideoInput,
  type ImageInput,
  type SvgInput,
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

export {
  type MediaCoordinates,
  type RenditionCoordinates,
  type RenditionRequest,
  type RenditionPlan,
  type CompiledMediaFile,
  type CompiledMediaRendition,
} from "./coordinates.js";

export type { MediaDiagnosticCode, MediaDiagnostic } from "./diagnostics.js";

export type {
  ResolveInput,
  ResolveResult,
  ResolveFn,
  ResolveCue,
  ResolveCueFinding,
  ResolveShotBreakdown,
  ResolveBreakdown,
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
  SuperImgErrorCode,
} from "./results.js";

export type {
  RenderExecutionErrorCode,
  RenderExecutionOptions,
  RenderLimits,
  LinkedExecutionSignal,
} from "./execution.js";
export {
  RenderExecutionError,
  executionErrorFromSignal,
  throwIfExecutionCancelled,
  createLinkedExecutionSignal,
  raceWithExecution,
} from "./execution.js";

export {
  SuperImgError,
  isSuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
  PlayerNotReadyError,
} from "./results.js";

// =============================================================================
// PLAYER TYPES (user-facing interfaces only)
// Browser session implementation types live in @superimg/media and @superimg/player.
// =============================================================================

export type { PlayerInput } from "./player.js";
export { inferTemplateAnimated } from "./player.js";

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
  FrameCaptureOptions,
  RasterizerConfig,
  RasterizerCapabilities,
  ResolvedFontFace,
  Rasterizer,
  VideoEncoderConfig,
  VideoEncoderDiagnostics,
  EncodedFileResult,
  VideoEncoder,
  RenderEngine,
  RenderPlan,
  FramePresenter,
  ResolvedAssetDeclaration,
  TemplateBundle,
  PreparedNativeModuleSet,
  CompilerDiagnostic,
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
// MEDIA IR (experimental draft, schemaVersion 0)
// =============================================================================

export type {
  MediaIRFrameRange,
  MediaIRTemporalCapability,
  MediaIRMotionCapability,
  MediaIRVisualCapability,
  MediaIRPortability,
  MediaIRDeterminism,
  MediaIRCapabilityIssue,
  MediaIRCapabilities,
  MediaIRProvenance,
  MediaIRPhase,
  MediaIRMarker,
  MediaIRTransition,
  MediaIRScene,
  MediaIRTrackKind,
  MediaIRTrack,
  MediaIREasing,
  MediaIRMotion,
  MediaIRAsset,
  MediaIRHashRun,
  MediaIRObservations,
  MediaIRHashes,
  MediaIRRenderConfig,
  MediaIRExtensionEnvelope,
  MediaIR,
  CreateMediaIROptions,
  MediaIRDiffConfidence,
  MediaIRDiffCategory,
  MediaIRDiffChange,
  MediaIRDiff,
  MediaIRQuery,
  MediaIRQueryResult,
  MediaJob,
  MediaArtifactFileEntry,
  MediaArtifactManifest,
  CompiledMediaArtifact,
  FrozenRenderArtifact,
} from "./media-ir.js";

export { createMediaIR, MEDIA_IR_STUB_HASH } from "./media-ir.js";

// =============================================================================
// EDITING (Studio source bindings / operations — experimental draft)
// =============================================================================

export type {
  EditCapability,
  EditUiState,
  EditTimeSpace,
  EditReasonCode,
  EditFramePoint,
  EditFrameRange,
  EditSourceBinding,
  EditManifest,
  EditOperationPreconditions,
  MediaEditCommand,
  EditTransaction,
  EditApplyResult,
  EditFrameObservation,
} from "./editing.js";

// =============================================================================
// RENDER CAPABILITIES / PATH NEGOTIATION (experimental draft)
// =============================================================================

export type {
  MediaCapabilities,
  MediaCapabilityName,
  RenderOutputFormat,
  RenderRequirements,
  RasterizerKind,
  EncoderKind,
  MediaDecoderKind,
  StitcherKind,
  FilesystemCapability,
  RuntimeCapabilities,
  RuntimeProfileName,
  RenderPath,
  UnsupportedRequirement,
  NegotiateRenderPathResult,
} from "./render-capabilities.js";

// =============================================================================
// TEMPLATE PACKAGE (experimental draft)
// =============================================================================

export type {
  PackageProgram,
  PackageAsset,
  TemplatePackage,
  TemplatePackageManifest,
  OutputRequest,
  PackageRejectCode,
  PackageRejectError,
} from "./template-package.js";

export type { DeployRuntimeProfile } from "./types.js";

// =============================================================================
// VALUE-FIRST RUNTIME
// =============================================================================

export {
  RuntimeInfrastructureError,
  RuntimeDisposedError,
  CapabilityUnavailableError,
  RuntimeCancelledError,
  MediaPreflightError,
  ExportBundleDisposedError,
} from "./runtime.js";
export type {
  OpaqueInteractiveMediaValue,
  DeterministicMediaValue,
  CollectionMediaValue,
  MediaValue,
  ExportableMedia,
  RuntimeDocumentFormat,
  RuntimeRasterFormat,
  RuntimeAnimatedFormat,
  RuntimeOutputFormat,
  MediaRuntimeCapabilities,
  InitOptions,
  Runtime,
  RuntimeMediaCoordinates,
  RuntimeRenditionCoordinates,
  RuntimeMediaKind,
  RuntimeFindingSeverity,
  RuntimeFindingCategory,
  RuntimeFinding,
  RuntimeTechnicalCoverage,
  ProviderResolution,
  RuntimeSelectionOptions,
  CheckOptions,
  CheckReport,
  InspectOptions,
  RuntimeMediaConfig,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  CollectionInspection,
  InspectReport,
  ExactRenderFormat,
  RenderFormat,
  MediaRenderOptions,
  MediaRenderResult,
  ExportRenditionRequest,
  ExportTarget,
  ExportProgressItem,
  ExportProgressWork,
  ExportProgressEvent,
  ExportOptions,
  ExportManifestArtifact,
  ExportManifest,
  ExportArtifact,
  ExportBundle,
  PublicationReceipt,
  DoctorReport,
  SetupOptions,
} from "./runtime.js";

// =============================================================================
// COLLECTION TYPES
// =============================================================================

export {
  collection,
  listCollectionEntries,
  type CollectionEntryItem,
  type CollectionEntryProvider,
  type CollectionEntries,
  type CollectionEntryIdResolver,
  type CollectionInput,
  type CollectionDefinition,
} from "./collection.js";

export type * from "./scene.js";
