//! Advanced prepared-source evaluation and inspection primitives.
export { prepareNodeMediaAnalysis, type PreparedNodeMediaAnalysis } from "../../superimg-node/src/library/source-analysis.js";
export { evaluatePreparedSourceIR, type IrEvalConfig, type IrEvalResult, type EvaluateTemplateIROptions } from "../../superimg-node/src/library/source-evaluate.js";
export { observeSourceSamples, semanticsFromCapture, withFrozenSourceFindings } from "../../superimg-node/src/library/source-inspect.js";
export { checkPreparedSource, runtimeFindingToIssue, runtimeAt, type CheckOptions, type CheckRuntimeContext } from "../../superimg-node/src/library/source-check.js";
export { applyDestinationTarget } from "../../superimg-node/src/library/for-target.js";
