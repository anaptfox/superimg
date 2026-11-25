//! @foxworth/superimg/ir — browser-safe Media IR APIs (no Node/DOM/Player/renderer)
//! Pure validate/serialize/hash/diff/query only. Artifact IO lives on @foxworth/superimg-interactions.

export type {
  MediaIRFrameRange,
  MediaIRCapabilities,
  MediaIRCapabilityIssue,
  MediaIR,
  MediaIRDiff,
  MediaIRDiffChange,
  MediaIRQuery,
  MediaIRQueryResult,
  MediaJob,
  MediaArtifactManifest,
  CompiledMediaArtifact,
  MediaIRScene,
  MediaIRMotion,
  MediaIRTrack,
  MediaIRAsset,
  MediaIRObservations,
  MediaIRHashes,
  MediaIRRenderConfig,
  RenderRequirements,
  RuntimeCapabilities,
  RuntimeProfileName,
  RenderPath,
  UnsupportedRequirement,
  NegotiateRenderPathResult,
} from "@superimg/types";

// Prefer package subpath so MediaIRError is not double-bundled vs @foxworth/superimg-interactions.
export {
  validateMediaIR,
  serializeMediaIR,
  serializeMediaIRPretty,
  computeMediaIRHashes,
  hashBytes,
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
  normalizeSourceId,
  lintMediaIR,
  timelineFromMediaIR,
  seekFrameForTimelineItem,
  itemsAtFrame,
  formatLaneItemHover,
  formatFrameAsSeconds,
  clampPlayheadFrame,
  capabilitiesForProfile,
  inspectRenderRequirements,
  negotiateRenderPath,
} from "@superimg/core/ir";
export type {
  MediaIRLintIssue,
  MediaIRLintOptions,
  TimelineProjectionOptions,
  TimelineLaneKind,
  TimelineCapability,
  TimelineLaneItem,
  TimelineLane,
  MultiTrackTimeline,
} from "@superimg/core/ir";

export { shouldFailMediaDiff, classifyExpectedChanges, parseSelector, matchId, diffSemantics } from "@superimg/core/ir";
export type { MediaDiffFailOn, SelectorKind, ParsedSelector, InspectDiff } from "@superimg/core/ir";
