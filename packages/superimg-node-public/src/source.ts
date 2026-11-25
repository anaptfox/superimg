export {
  assertPreparedMediaSource,
  assertSnapshotCurrent,
  compileNodeMediaSource,
  hashJson,
  listNodeMediaLocalAssets,
  loadNodeMediaValue,
  materializeNodeMediaAssets,
  providerDigest,
  prepareSource,
  resolveNodeMediaSourceAnalysis,
  snapshotCollection
} from "../../superimg-node/src/library/source-entry.js";
export type {
  CompiledNodeMediaSource,
  LoadedNodeMediaValue,
  LoadNodeMediaValueOptions,
  MediaCollectionSnapshot,
  MediaCollectionSnapshotEntry,
  MediaJsonObject,
  MediaJsonValue,
  NodeMediaAuthoringOptions,
  ProviderExecutionOptions,
  PreparedSource,
  PrepareSourceOptions
} from "../../superimg-node/src/library/source-entry.js";

// Provider-free checks on compiled or already-loaded sources.
export { checkCompiledSource, inspectCompiledSource } from "../../superimg-node/src/library/source-analysis.js";
export { checkNodeSource } from "../../superimg-node/src/library/source-check.js";
export type { CheckReport, CheckIssue, CheckSample, CheckPhase } from "../../superimg-node/src/library/source-check.js";
export { inspectPreparedSource, type PreparedSourceInspection, type SourceInspectionSample } from "../../superimg-node/src/library/source-inspect.js";

// Script files: which films read a script, and where its blocks sit on a film's clock.
export { findScriptSources, readScriptCues, MediaScriptError, fitPngWidth, pngSize } from "../../superimg-node/src/library/script.js";
export type { MediaScriptCue, MediaScriptCueFinding, MediaScriptCues, MediaScriptSource, MediaScriptSources } from "../../superimg-node/src/library/script.js";
