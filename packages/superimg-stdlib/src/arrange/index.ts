export { ArrangeError } from "./error.js";
export {
  alignedIntervals,
  checkAlignedIntervals,
} from "./aligned-intervals.js";
export { checkMechanismStrip, mechanismStrip } from "./mechanism-strip.js";
export {
  checkPointWithContext,
  pointWithContext,
} from "./point-with-context.js";
export {
  checkRegisteredComparison,
  registeredComparison,
} from "./registered-comparison.js";
export {
  checkValueAgainstReference,
  valueAgainstReference,
} from "./value-against-reference.js";
export {
  ARRANGE_PATTERN_IDS,
  ArrangeRequestError,
  isArrangePatternId,
  parseArrangeRequest,
  type ArrangeAsset,
  type ArrangePatternId,
  type ArrangeRequest,
  type ArrangeSpecById,
  type PortableSpecimenView,
} from "./portable.js";
export {
  ARRANGE_PATTERNS,
  arrangePattern,
  checkArrangeRequest,
  findArrangePattern,
  renderArrangeRequest,
  type AnyArrangePattern,
  type ArrangePattern,
} from "./registry.js";
export { ARRANGE_PATTERN_SCHEMAS, type ArrangeJsonSchema } from "./schemas.js";
export type {
  AlignedIntervalsSpec,
  ArrangeBase,
  ArrangeFailure,
  ArrangeFailureCode,
  ArrangeSize,
  ComparisonFrame,
  EvidenceKind,
  Interval,
  IntervalMotion,
  IntervalMotionPhase,
  IntervalPredictMode,
  IntervalTrack,
  PointCorrespondence,
  PointWithContextSpec,
  ReferenceItem,
  Region,
  RegisteredComparisonSpec,
  Specimen,
  SpecimenView,
  SrcView,
  TimeRef,
  TimeUnit,
  ValueAgainstReferenceSpec,
} from "./types.js";

import { alignedIntervals, checkAlignedIntervals } from "./aligned-intervals.js";
import { checkPointWithContext, pointWithContext } from "./point-with-context.js";
import {
  checkRegisteredComparison,
  registeredComparison,
} from "./registered-comparison.js";
import {
  checkValueAgainstReference,
  valueAgainstReference,
} from "./value-against-reference.js";

import { checkMechanismStrip, mechanismStrip } from "./mechanism-strip.js";
import { parseArrangeRequest } from "./portable.js";
import {
  ARRANGE_PATTERNS,
  checkArrangeRequest,
  findArrangePattern,
  renderArrangeRequest,
} from "./registry.js";

/** Perceptual arrangements. Each call names work to remove and throws if invariants fail. */
export const arrange = {
  pointWithContext,
  registeredComparison,
  alignedIntervals,
  valueAgainstReference,
  mechanismStrip,
  /** Every registered pattern, with its schema, failure codes, and behaviour. */
  patterns: ARRANGE_PATTERNS,
  pattern: findArrangePattern,
  /** Portable JSON door: parse, admit, then render. */
  parseRequest: parseArrangeRequest,
  checkRequest: checkArrangeRequest,
  renderRequest: renderArrangeRequest,
  check: {
    pointWithContext: checkPointWithContext,
    registeredComparison: checkRegisteredComparison,
    alignedIntervals: checkAlignedIntervals,
    valueAgainstReference: checkValueAgainstReference,
    mechanismStrip: checkMechanismStrip,
  },
};
