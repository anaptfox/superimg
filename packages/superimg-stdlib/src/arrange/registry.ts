//! Self-describing pattern registry.
//!
//! Each entry carries its own `check` and `render`, so nothing downstream
//! switches on a pattern id: a door looks the entry up and calls it. Adding a
//! pattern is one appended entry, and it reaches every surface at once — the
//! CLI, the operation contract, and the generated plugin reference.

import type { MediaElement } from "../tree/node-types.js";
import { alignedIntervals, checkAlignedIntervals } from "./aligned-intervals.js";
import { checkMechanismStrip, mechanismStrip } from "./mechanism-strip.js";
import { checkPointWithContext, pointWithContext } from "./point-with-context.js";
import {
  checkRegisteredComparison,
  registeredComparison,
} from "./registered-comparison.js";
import {
  checkValueAgainstReference,
  valueAgainstReference,
} from "./value-against-reference.js";
import { ARRANGE_PATTERN_SCHEMAS, type ArrangeJsonSchema } from "./schemas.js";
import type {
  ArrangePatternId,
  ArrangeRequest,
  ArrangeSpecById,
} from "./portable.js";
import type {
  AlignedIntervalsSpec,
  ArrangeFailure,
  ArrangeFailureCode,
  IntervalMotionPhase,
} from "./types.js";

export interface ArrangePattern<Id extends ArrangePatternId = ArrangePatternId> {
  readonly id: Id;
  readonly title: string;
  /** Generic phrasing of the work this pattern takes out of the reader's head. */
  readonly workRemoved: string;
  /** Every code this pattern's `check` can emit. */
  readonly failureCodes: readonly ArrangeFailureCode[];
  readonly schema: ArrangeJsonSchema;
  /** True when the pattern has phased motion worth rendering over time. */
  readonly motion: boolean;
  /** Progress in the completed answer hold, when the pattern has one. */
  readonly posterProgress?: number;
  check(spec: ArrangeSpecById[Id]): ArrangeFailure[];
  render(spec: ArrangeSpecById[Id], phase?: IntervalMotionPhase): MediaElement;
}

export type AnyArrangePattern = {
  [Id in ArrangePatternId]: ArrangePattern<Id>;
}[ArrangePatternId];

/** Codes every pattern can emit, from the shared admission check. */
const BASE_CODES: readonly ArrangeFailureCode[] = [
  "missing-question",
  "missing-work",
  "missing-evidence",
];

/**
 * Validates one entry against its own pattern id. Checking entries one at a
 * time keeps each spec type exact; a whole-record `satisfies` defers the
 * mapped type and loses the per-key pairing.
 */
function definePattern<Id extends ArrangePatternId>(
  entry: ArrangePattern<Id>,
): ArrangePattern<Id> {
  return Object.freeze(entry);
}

/** Phase is a render-time argument; the spec keeps whatever it declared. */
function withPhase(
  spec: AlignedIntervalsSpec,
  phase: IntervalMotionPhase | undefined,
): AlignedIntervalsSpec {
  if (phase === undefined || spec.motion === undefined) return spec;
  return { ...spec, motion: { ...spec.motion, phase } };
}

type ArrangePatternRecord = { [Id in ArrangePatternId]: ArrangePattern<Id> };

const PATTERNS: ArrangePatternRecord = {
  "point-with-context": definePattern({
    id: "point-with-context",
    title: "Point with context",
    workRemoved: "Finding the object being discussed inside its surroundings",
    failureCodes: [
      ...BASE_CODES,
      "missing-provenance",
      "missing-correspondence",
      "focus-not-locatable",
    ],
    schema: ARRANGE_PATTERN_SCHEMAS["point-with-context"],
    motion: false,
    check: checkPointWithContext,
    render: (spec) => pointWithContext(spec),
  }),
  "registered-comparison": definePattern({
    id: "registered-comparison",
    title: "Registered comparison",
    workRemoved:
      "Matching corresponding elements across states while holding the reference frame",
    failureCodes: [
      ...BASE_CODES,
      "missing-provenance",
      "missing-correspondence",
      "unaligned-frame",
    ],
    schema: ARRANGE_PATTERN_SCHEMAS["registered-comparison"],
    motion: false,
    check: checkRegisteredComparison,
    render: (spec) => registeredComparison(spec),
  }),
  "aligned-intervals": definePattern({
    id: "aligned-intervals",
    title: "Aligned intervals",
    workRemoved: "Computing overlap, order, and concurrency across separate records",
    failureCodes: [
      ...BASE_CODES,
      "missing-correspondence",
      "missing-time-ref",
      "unaligned-frame",
      "predict-spoils",
      "too-dense",
    ],
    schema: ARRANGE_PATTERN_SCHEMAS["aligned-intervals"],
    motion: true,
    posterProgress: 0.8,
    check: checkAlignedIntervals,
    render: (spec, phase) => alignedIntervals(withPhase(spec, phase), phase),
  }),
  "value-against-reference": definePattern({
    id: "value-against-reference",
    title: "Value against reference",
    workRemoved: "Remembering a baseline while scanning current values",
    failureCodes: [...BASE_CODES, "missing-correspondence", "unaligned-frame"],
    schema: ARRANGE_PATTERN_SCHEMAS["value-against-reference"],
    motion: false,
    check: checkValueAgainstReference,
    render: (spec) => valueAgainstReference(spec),
  }),
  "mechanism-strip": definePattern({
    id: "mechanism-strip",
    title: "Mechanism strip",
    workRemoved:
      "Tracing how parts connect, in what order, and on whose evidence each step rests",
    failureCodes: [
      ...BASE_CODES,
      "missing-correspondence",
      "unaligned-frame",
      "unsupported-claim",
      "too-dense",
      "predict-spoils",
    ],
    schema: ARRANGE_PATTERN_SCHEMAS["mechanism-strip"],
    motion: true,
    posterProgress: 0.8,
    check: checkMechanismStrip,
    render: (spec, phase) => mechanismStrip(spec, phase),
  }),
};

export const ARRANGE_PATTERNS: readonly AnyArrangePattern[] = Object.freeze(
  Object.values(PATTERNS),
);

/** Typed lookup for a known pattern id. */
export function arrangePattern<Id extends ArrangePatternId>(id: Id): ArrangePattern<Id> {
  return PATTERNS[id];
}

/** Lookup for an id that came off a wire and may not be a pattern at all. */
export function findArrangePattern(id: string): AnyArrangePattern | undefined {
  return ARRANGE_PATTERNS.find((entry) => entry.id === id);
}

// `pattern` and `spec` are paired by parseArrangeRequest, but an indexed
// lookup loses that correlation, so dispatch needs one widening assertion.
function entryFor(request: ArrangeRequest): ArrangePattern<ArrangePatternId> {
  return PATTERNS[request.pattern] as ArrangePattern<ArrangePatternId>;
}

/** Admission for a portable request. Same failures as calling `check` directly. */
export function checkArrangeRequest(request: ArrangeRequest): ArrangeFailure[] {
  return entryFor(request).check(request.spec);
}

/** Render a portable request. `phase` applies only to motion patterns. */
export function renderArrangeRequest(
  request: ArrangeRequest,
  phase?: IntervalMotionPhase,
): MediaElement {
  return entryFor(request).render(request.spec, phase);
}
