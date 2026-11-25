//! SuperImg Core - Browser-safe primitives
//! Types, compilation, validation. NO html (use @superimg/core/html)

// Re-export types for convenience
export type {
  RenderContext,
  ImageRenderContext,
  SvgRenderContext,
  FitMode,
  CssViewport,
  RenderOptions,
  Medium,
  AnyTemplateModule,
  TemplateModule,
  TemplateConfig,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  Checkpoint,
  CheckpointSource,
  Marker,
  MarkerPosition,
  Duration,
} from "@superimg/types";

// Core functionality (browser-safe only)
export * from "./shared/constants.js";
export { planNarration, preparedNarrationAudio } from "./shared/narration-plan.js";
export * from "./rendering/create-render-context.js";
export * from "./rendering/render-frame.js";
export { lowerRenderOutput, asRenderOutput } from "./rendering/lower-output.js";
export { cancellationError, isAbortError, raceSignal } from "./rendering/abort-signal.js";
export {
  textMeasurerFromFaces,
  textMeasurerFromResolved,
  measurerForPlan,
} from "./rendering/text-measurer.js";
export { textMeasurerForDeclarations } from "./rendering/text-measurer-declarations.js";
export { walkMediaTree } from "@superimg/stdlib/tree/walk";
export type { TreeNodeSemantics } from "@superimg/stdlib/tree/walk";
export * from "./rendering/runtime-info.js";
export * from "./shared/stdlib-capabilities.js";
export * from "./rendering/compiler.js";
export * from "./rendering/resolve-template.js";
export * from "./rendering/probe-phases.js";
export * from "./destinations/index.js";
export * from "./export/index.js";
// Bind Node ensureInit at package load (tsdown drops pure side-effect imports).
import { bindEnsureInit } from "./rendering/resvg-rasterizer.js";
import { nodeEnsureInit } from "./rendering/resvg-ensure-init.node.js";
bindEnsureInit(nodeEnsureInit);
export {
  ensureInit,
  rasterize,
  rasterizeSvgSync,
  ResvgRasterizer,
  bindEnsureInit,
} from "./rendering/resvg-rasterizer.js";
export type { WasmSource, RasterizeSvgOptions } from "./rendering/resvg-rasterizer.js";
export * from "./rendering/fonts.js";
export * from "./rendering/font-css.js";
export * from "./rendering/rasterizer-registry.js";
export * from "./shared/assets.js";
export * from "./shared/asset-metadata.js";
export * from "./rendering/checkpoint-resolver.js";
export * from "./html/sanitize.js";
export * from "./html/css.js";

// Scene composition
export { compose } from "./composition/compose.js";
export { sequence } from "./composition/sequence.js";
export { choose } from "./composition/choose.js";
export { together } from "./composition/together.js";
export { time } from "./composition/time.js";
export { rebaseCompositionSources } from "./composition/rebase.js";
export type { CompositionSourceBases } from "./composition/rebase.js";
export { replaceOccurrence } from "./composition/replace.js";
export { diffCompositionSchedules } from "./composition/diff.js";
export type { CompositionScheduleDiff, ScheduleRangeChange } from "./composition/diff.js";
export { planComposition, compositionSchedule } from "./composition/plan.js";
export type { CompositionPlan, CompositionProjectionOptions, PlannedLeaf } from "./composition/plan.js";
export { prepareComposition } from "./composition/prepare.js";
export type {
  CompositionAssetProvider,
  CompositionAssetRequest,
  PreparedCompositionAsset,
  PrepareCompositionOptions,
  PreparedComposition,
} from "./composition/prepare.js";
export { collectComposeAudio } from "./shared/assets.js";
export {
  resolveAudioTimeline,
  mixAudioClips,
  normalizeAudioInput,
  ensureClipIds,
  inferAudioRole,
  sceneBoundariesFromResolved,
  interleaveStereo,
  TARGET_SAMPLE_RATE,
  TARGET_CHANNELS,
} from "./shared/assets.js";
export { parseDuration } from "./shared/utils.js";

// Edge rendering
export * from "./edge.js";

// Media IR — import pure modules directly (avoid re-exporting ./ir entry so
// tsdown does not clobber dist/index.d.ts with the ir subpath types).
export {
  validateMediaIR,
  serializeMediaIR,
  serializeMediaIRPretty,
  computeMediaIRHashes,
  hashBytes,
  hashTemplateOutputs,
  sha256Hex,
  diffMediaIR,
  queryMediaIR,
  selectVerificationFrames,
  MediaIRError,
  canonicalize,
  canonicalizeToJson,
  mergeRanges,
  qualifyId,
  parseQualifiedId,
  assertFrameRange,
  frameInRange,
} from "./ir/pure/index.js";
export type {
  SelectVerificationFramesOptions,
  MediaIRErrorCode,
} from "./ir/pure/index.js";
export {
  resolveMediaIR,
  resolveMediaIRFromBundle,
  normalizeSourceId,
} from "./ir/resolve-media-ir.js";
export type {
  ResolveMediaIROptions,
  ResolveMediaIRResult,
  MediaIRFrameCapture,
} from "./ir/resolve-media-ir.js";
export {
  capabilitiesForProfile,
  inspectRenderRequirements,
  negotiateRenderPath,
  assertSafePackagePath,
  computePackageHash,
  validateTemplatePackage,
  buildTemplatePackage,
  validatePackageManifestFiles,
  assertNoSourceUpload,
  validateJobDataAgainstSchema,
} from "./ir/pure/index.js";
export {
  compileTemplatePackage,
  type CompileTemplatePackageOptions,
} from "./ir/compile-template-package.js";

import { installStillLaneKit } from "./rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "./rendering/still-lane-install.js";

installStillLaneKit(defaultStillLaneKit);
export { toTemplateSourceMap } from "./bundler/source-map.js";

export { normalizeCues, type NormalizedCue } from "./rendering/normalize-cues.js";
