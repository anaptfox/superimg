//! SuperImg - Template and core SDK exports

export { isMediaElement } from "@superimg/types";

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core render context
  RenderContext,
  CssViewport,

  // Mode types
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  DriveSource,
  FitMode,

  // Template types
  Medium,
  MediaDefinition,
  DeterministicMediaDefinition,
  Program,
  CompositionContent,
  Use,
  SequenceProgram,
  TogetherProgram,
  PlacedUse,
  ChooseProgram,
  CompositionLeafSchedule,
  CompositionSchedule,
  CompositionPlacement,
  RetainedComposition,
  CompositionEntryData,
  VideoDefinition,
  ImageDefinition,
  SvgDefinition,
  VideoInput,
  ImageInput,
  SvgInput,
  CanvasSize,
  MediaEdition,
  MediaEditions,
  MediaVariantPatch,
  MediaVariants,
  ReviewPlan,
  ReviewBeat,
  ReviewCheck,
  ReviewObservationContext,
  DefineInput,
  DefineHtmlAnimatedInput,
  DefineHtmlStaticInput,
  DefineSvgAnimatedInput,
  DefineSvgStaticInput,
  TemplateConfig,
  ProjectConfig,
  TailwindConfig,

  // Timing
  Duration,

  // Encoding options
  EncodingOptions,
  OutputFormat,
  VideoCodecPreference,
  AudioCodecPreference,
  QualityPreset,

  // Asset types
  AssetMeta,
  AssetKind,
  AssetDeclaration,
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
  RenderBufferResult,

  // Checkpoint types
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,

  // Deterministic collections
  CollectionDefinition,
  CollectionEntries,
  CollectionEntryItem,
  CollectionEntryProvider,
  CollectionEntryIdResolver,
  CollectionInput,

  // Narration
  NarrationPlan,
  NarrationPlanSegment,
  NarrationSegmentTiming,
  MeasuredNarrationSegment,
  NarrationTimingOptions,
  NarrationFinding,

  // Runtime export & publication contracts (schema-aligned for cloud studio hosts)
  ExportBundle,
  ExportArtifact,
  ExportManifest,
  ExportManifestArtifact,
  ExportOptions,
  MediaRenderOptions,
  MediaRenderResult,
  RuntimeMediaCoordinates,
  RuntimeRenditionCoordinates,
  PublicationReceipt,

  // Stdlib type
  Stdlib,
  ImageStdlib,
  SvgStdlib,
  SvgAnimatedStdlib,

  // Render contexts (static / svg / animated-svg)
  ImageRenderContext,
  SvgRenderContext,
  SvgAnimatedRenderContext,

  MediaNode,
  MediaChild,
  MediaElement,
  MediaLayout,
  MediaStylePropertyValue,
  MediaStyleObject,
  MediaMotionValue,
  MediaStyleValue,
  MediaProps,
  MediaAttributes,
  RenderOutput,

  FontSource,
  FontDeclaration,
  GoogleFontDeclaration,
  FontInput,
} from "@superimg/types";

// Template authoring helpers. Keep the root runtime graph intentionally small;
// value execution belongs to `@foxworth/superimg/runtime`; controlled host work belongs
// to the Node-only `@foxworth/superimg-interactions` entry.
// Do not import `@superimg/core/template-runtime` here — that module loads the
// layout-tree barrel (Code → stdlib/code) and would collapse the browser code chunk.
export {
  define,
  video,
  image,
  svg,
  ogImage,
  collection,
  listCollectionEntries,
  googleFont,
} from "@superimg/types";
export { sequence, together, choose, time, rebaseCompositionSources, replaceOccurrence, diffCompositionSchedules } from "@superimg/core/composition";
export { source } from "./source.js";
export type { SourceInput, SourceFit, SourceImageOptions, SourceVideoOptions } from "./source.js";
export type { CompositionScheduleDiff, ScheduleRangeChange } from "@superimg/core/composition";
export { layoutTimeline } from "@superimg/stdlib/layout-timeline";
export { arrange, ArrangeError } from "@superimg/stdlib/arrange";
export type {
  AlignedIntervalsSpec,
  ArrangeFailure,
  EvidenceKind,
  PointWithContextSpec,
  RegisteredComparisonSpec,
} from "@superimg/stdlib/arrange";

// Error classes
export {
  SuperImgError,
  isSuperImgError,
  TemplateRuntimeError,
  IOError,
} from "@superimg/types";
export type { SuperImgErrorCode } from "@superimg/types";
