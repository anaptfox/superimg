//! Browser-safe pure Media IR APIs (no Node/DOM/Player/renderer).

export { MediaIRError, type MediaIRErrorCode } from "./errors.js";
export { canonicalize, canonicalizeToJson } from "./canonicalize.js";
export {
  assertFrameRange,
  mergeRanges,
  rangesOverlap,
  frameInRange,
  qualifyId,
  parseQualifiedId,
} from "./ranges.js";
export { validateMediaIR } from "./validate.js";
export {
  serializeMediaIR,
  serializeMediaIRPretty,
  computeMediaIRHashes,
  hashBytes,
  hashTemplateOutputs,
} from "./serialize.js";
export { sha256Hex } from "./sha256.js";
export { diffMediaIR } from "./diff.js";
export { queryMediaIR } from "./query.js";
export {
  selectBoundaryFrames,
  selectVerificationFrames,
  type SelectVerificationFramesOptions,
} from "./frames.js";
export {
  lintMediaIR,
  type MediaIRLintIssue,
  type MediaIRLintOptions,
} from "./lint.js";
export {
  capabilitiesForProfile,
  inspectRenderRequirements,
  negotiateRenderPath,
} from "./negotiate.js";
export {
  assertSafePackagePath,
  computePackageHash,
  validateTemplatePackage,
  buildTemplatePackage,
  validatePackageManifestFiles,
  assertNoSourceUpload,
} from "./template-package.js";
export { validateJobDataAgainstSchema } from "./job-data-schema.js";
// Timeline projection is exported from ../index (ir entry) via pure/timeline.js
// so the root package index is not forced into an oversized shared d.ts chunk.

export { shouldFailMediaDiff, type MediaDiffFailOn } from "./comparison.js";
export { parseSelector, matchId, classifyExpectedChanges, type SelectorKind, type ParsedSelector } from "./change-selectors.js";
export { diffSemantics, type InspectDiff } from "./semantic-diff.js";
