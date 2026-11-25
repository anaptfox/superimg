//! Pure edit helpers — browser-safe (no filesystem, DOM, or oxc-parser).

export { EditError, type EditErrorCode } from "./errors.js";
export {
  assertEditFrame,
  assertEditFramePoint,
  assertEditFrameRange,
  convertEditFramePoint,
  convertEditFrameRange,
  globalFrameToScene,
  isP0TimeSpace,
  sceneFrameToGlobal,
  sceneLengthFrames,
} from "./time.js";
export {
  makeCompositionHoldBindingId,
  makeDurationBindingId,
  makePhaseBindingId,
  makePropertyBindingId,
  parseCompositionHoldBindingId,
  parseDurationBindingId,
  parsePhaseBindingId,
  parsePropertyBindingId,
} from "./ids.js";
export {
  toEditUiState,
  visualCapabilityToEdit,
} from "./capability.js";
export {
  cloneMediaEditCommand,
  roundTripEditManifest,
  roundTripMediaEditCommand,
  validateEditManifest,
  validateMediaEditCommand,
} from "./validate.js";
export {
  invertOperation,
  invertSetNodeTransform,
  invertSetCompositionHold,
  invertSetPhaseBoundary,
  invertTrimSceneEnd,
} from "./inverse.js";
export {
  assertEffectPolicy,
  expectedSpatialAffectedRanges,
  validatePhaseBoundaryEffectPolicy,
  validateCompositionHoldEffectPolicy,
  validateSpatialEffectPolicy,
  validateTemporalEffectPolicy,
  type EffectPolicyResult,
} from "./effect-policy.js";
