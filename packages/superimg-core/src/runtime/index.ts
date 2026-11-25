//! Internal value-first runtime kernel.
//!
//! Platform packages consume this curated module. It intentionally contains no
//! source loading, filesystem publication, Ops First authority, or public custom
//! adapter registry.

export {
  createRuntime,
  check,
  prepareRuntimeReport,
  inspect,
  render,
  exportMedia,
  inspectFile,
  startConversion,
  startExport,
} from "./kernel.js";
export type { PreparedRuntimeReport } from "./report-preparation.js";
export { assertPreparedRuntimeReport } from "./report-preparation.js";
export { bindRuntimeApi, type RuntimeApi } from "./bind.js";
export { matchCortexView, type CortexMatch } from "../cortex/match.js";
export {
  planCortexRender,
  startCortexExport,
  cortexArtifactRecord,
  CortexNoViewError,
  type CortexPlan,
} from "../cortex/render.js";
export { createConversionArtifact } from "./conversion.js";

export {
  createExportBundle,
  createMediaRenderResult,
  freezeJsonObject,
  type CreateExportBundleInput,
} from "./bundle.js";

export {
  analyzeExportMediaValue,
  digestMediaProgram,
  analyzeMediaValue,
  authoredRenderFailureFinding,
  includeSemanticIR,
  parseRuntimeAt,
  type RuntimeInspectionContribution,
  type SemanticAnalysis,
} from "./semantic.js";

export {
  assertPortableArtifactPath,
  assertMimeType,
  verifyAndOwnBytes,
  readByteStream,
} from "./bytes.js";

export type {
  RuntimeAdapter,
  RuntimeAdapterInspectionRequest,
  RuntimeAdapterCollectionRequest,
  RuntimeAdapterPreflightRequest,
  RuntimeAdapterPreflight,
  RuntimeAdapterRenderRequest,
  RuntimeAdapterRenderOutput,
  RuntimeAdapterExportRequest,
  RuntimeAdapterArtifactData,
  RuntimeArtifactBacking,
  RuntimeAdapterExportOutput,
  RuntimeAdapterConversionRequest,
  RuntimeAdapterConversionOutput,
} from "./adapter.js";

export type {
  RuntimeCollectionEntry,
  RuntimeMediaSelection,
} from "./selection.js";
export { prepareRuntimeCompositionMedia } from "./selection.js";
export { selectMediaDefinition } from "./selection-value.js";

import { installStillLaneKit } from "../rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "../rendering/still-lane-install.js";

installStillLaneKit(defaultStillLaneKit);

export { staticCollectionEntries } from "./selection.js";
export { resolveEncodedFrame, resolveFrameIndex } from "../shared/frame-clock.js";
