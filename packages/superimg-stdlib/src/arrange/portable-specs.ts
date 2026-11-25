//! Per-pattern spec parsing for portable arrangement requests.
//!
//! Shape and type validation only. Invariants stay in each pattern's `check*`
//! function, so a well-formed request describing an impossible arrangement
//! fails as an `ArrangeFailure` naming the broken invariant, not as a parse
//! error. Parse answers "is this the right shape"; check answers "does the
//! benefit survive".

import {
  ArrangeRequestError,
  asArray,
  asRecord,
  optionalBoolean,
  optionalEnum,
  optionalFiniteNumber,
  optionalString,
  optionalStringArray,
  rejectUnknownKeys,
  requiredEnum,
  requiredFiniteNumber,
  requiredString,
  validatePortableSrc,
} from "./portable-helpers.js";
import type {
  AlignedIntervalsSpec,
  ArrangeBase,
  ArrangeSize,
  ComparisonFrame,
  EvidenceKind,
  Interval,
  IntervalMotion,
  IntervalMotionPhase,
  IntervalPredictMode,
  IntervalTrack,
  MechanismEdge,
  MechanismLayout,
  MechanismMotion,
  MechanismNode,
  MechanismStripSpec,
  PointCorrespondence,
  PointWithContextSpec,
  ReferenceItem,
  Region,
  RegisteredComparisonSpec,
  Specimen,
  SrcView,
  TimeRef,
  TimeUnit,
  ValueAgainstReferenceSpec,
} from "./types.js";

const EVIDENCE_KINDS: ReadonlySet<EvidenceKind> = new Set([
  "observation",
  "derived",
  "interpretation",
  "proposal",
]);
const FIT_MODES: ReadonlySet<NonNullable<SrcView["fit"]>> = new Set([
  "cover",
  "contain",
  "fill",
]);
const POINT_CORRESPONDENCE: ReadonlySet<PointCorrespondence> = new Set([
  "inset",
  "highlight",
  "panels",
]);
const COMPARISON_LAYOUTS: ReadonlySet<NonNullable<RegisteredComparisonSpec["layout"]>> = new Set([
  "side-by-side",
  "stacked",
]);
const COMPARISON_SCALES: ReadonlySet<NonNullable<ComparisonFrame["scale"]>> = new Set([
  "shared",
  "independent",
]);
const REFERENCE_SCALES: ReadonlySet<NonNullable<ValueAgainstReferenceSpec["frame"]["scale"]>> =
  new Set(["shared", "per-item"]);
const TIME_UNITS: ReadonlySet<TimeUnit> = new Set(["ms", "s", "min", "hour", "day"]);
const MOTION_PHASES: ReadonlySet<IntervalMotionPhase> = new Set(["hold", "predict", "reveal"]);
const PREDICT_MODES: ReadonlySet<IntervalPredictMode> = new Set(["tick", "empty", "ghost"]);
const LAYOUT_KINDS: ReadonlySet<MechanismLayout["kind"]> = new Set(["pipeline", "layers"]);
const MECHANISM_NODE_KEYS = new Set(["id", "label", "note"]);
const MECHANISM_EDGE_KEYS = new Set(["from", "to", "label", "claim"]);
const MECHANISM_MOTION_KEYS = new Set(["phase", "revealIds"]);

const BASE_KEYS = ["question", "workRemoved", "evidence", "source", "size"] as const;
const SPECIMEN_KEYS = new Set(["id", "label", "view", "provenance"]);
const FOCUS_KEYS = new Set(["id", "label", "view", "provenance", "region"]);
const SIZE_KEYS = new Set(["width", "height"]);
const REGION_KEYS = new Set(["x", "y", "width", "height"]);

function withBaseKeys(...extra: string[]): ReadonlySet<string> {
  return new Set([...BASE_KEYS, ...extra]);
}

function parseSize(value: unknown, path: string): ArrangeSize | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, path);
  rejectUnknownKeys(record, SIZE_KEYS, path);
  return {
    width: requiredFiniteNumber(record.width, `${path}.width`),
    height: requiredFiniteNumber(record.height, `${path}.height`),
  };
}

function parseBase(record: Record<string, unknown>, path: string): ArrangeBase {
  const source = optionalString(record.source, `${path}.source`);
  const size = parseSize(record.size, `${path}.size`);
  return {
    question: requiredString(record.question, `${path}.question`),
    workRemoved: requiredString(record.workRemoved, `${path}.workRemoved`),
    evidence: requiredEnum(record.evidence, EVIDENCE_KINDS, `${path}.evidence`),
    ...(source === undefined ? {} : { source }),
    ...(size === undefined ? {} : { size }),
  };
}

function parseSrcView(
  value: unknown,
  assetIds: ReadonlySet<string>,
  path: string,
): SrcView {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["src", "fit"]), path);
  const src = requiredString(record.src, `${path}.src`);
  validatePortableSrc(src, assetIds, `${path}.src`);
  const fit = optionalEnum(record.fit, FIT_MODES, `${path}.fit`);
  return { src, ...(fit === undefined ? {} : { fit }) };
}

function parseSpecimen(
  value: unknown,
  assetIds: ReadonlySet<string>,
  path: string,
): Specimen {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, SPECIMEN_KEYS, path);
  const provenance = optionalString(record.provenance, `${path}.provenance`);
  return {
    id: requiredString(record.id, `${path}.id`),
    label: requiredString(record.label, `${path}.label`),
    view: parseSrcView(record.view, assetIds, `${path}.view`),
    ...(provenance === undefined ? {} : { provenance }),
  };
}

function parseRegion(value: unknown, path: string): Region | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, path);
  rejectUnknownKeys(record, REGION_KEYS, path);
  return {
    x: requiredFiniteNumber(record.x, `${path}.x`),
    y: requiredFiniteNumber(record.y, `${path}.y`),
    width: requiredFiniteNumber(record.width, `${path}.width`),
    height: requiredFiniteNumber(record.height, `${path}.height`),
  };
}

function parsePointWithContext(
  record: Record<string, unknown>,
  assetIds: ReadonlySet<string>,
  path: string,
): PointWithContextSpec {
  rejectUnknownKeys(record, withBaseKeys("context", "focus", "correspondence"), path);
  const focusPath = `${path}.focus`;
  const focus = asRecord(record.focus, focusPath);
  rejectUnknownKeys(focus, FOCUS_KEYS, focusPath);
  const provenance = optionalString(focus.provenance, `${focusPath}.provenance`);
  const region = parseRegion(focus.region, `${focusPath}.region`);
  return {
    ...parseBase(record, path),
    context: parseSpecimen(record.context, assetIds, `${path}.context`),
    focus: {
      id: requiredString(focus.id, `${focusPath}.id`),
      label: requiredString(focus.label, `${focusPath}.label`),
      view: parseSrcView(focus.view, assetIds, `${focusPath}.view`),
      ...(provenance === undefined ? {} : { provenance }),
      ...(region === undefined ? {} : { region }),
    },
    correspondence: requiredEnum(
      record.correspondence,
      POINT_CORRESPONDENCE,
      `${path}.correspondence`,
    ),
  };
}

function parseViewport(
  value: unknown,
  path: string,
): { width: number; height: number } | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, path);
  rejectUnknownKeys(record, SIZE_KEYS, path);
  return {
    width: requiredFiniteNumber(record.width, `${path}.width`),
    height: requiredFiniteNumber(record.height, `${path}.height`),
  };
}

function parseComparisonFrame(value: unknown, path: string): ComparisonFrame {
  const record = asRecord(value, path);
  rejectUnknownKeys(
    record,
    new Set(["viewport", "units", "crop", "timeWindow", "scale"]),
    path,
  );
  const viewport = parseViewport(record.viewport, `${path}.viewport`);
  const units = optionalString(record.units, `${path}.units`);
  const crop = optionalString(record.crop, `${path}.crop`);
  const timeWindow = optionalString(record.timeWindow, `${path}.timeWindow`);
  const scale = optionalEnum(record.scale, COMPARISON_SCALES, `${path}.scale`);
  return {
    ...(viewport === undefined ? {} : { viewport }),
    ...(units === undefined ? {} : { units }),
    ...(crop === undefined ? {} : { crop }),
    ...(timeWindow === undefined ? {} : { timeWindow }),
    ...(scale === undefined ? {} : { scale }),
  };
}

function parseRegisteredComparison(
  record: Record<string, unknown>,
  assetIds: ReadonlySet<string>,
  path: string,
): RegisteredComparisonSpec {
  rejectUnknownKeys(
    record,
    withBaseKeys("states", "frame", "correspondence", "mismatches", "layout"),
    path,
  );
  const states = asArray(record.states, `${path}.states`).map((state, index) =>
    parseSpecimen(state, assetIds, `${path}.states.${index}`),
  );
  const mismatches = optionalStringArray(record.mismatches, `${path}.mismatches`);
  const layout = optionalEnum(record.layout, COMPARISON_LAYOUTS, `${path}.layout`);
  return {
    ...parseBase(record, path),
    // A comparison of fewer than two states is an arrangement failure, not a
    // parse failure: checkRegisteredComparison reports missing-correspondence.
    states: states as RegisteredComparisonSpec["states"],
    frame: parseComparisonFrame(record.frame, `${path}.frame`),
    correspondence: asArray(record.correspondence, `${path}.correspondence`).map(
      (item, index) => requiredString(item, `${path}.correspondence.${index}`),
    ),
    ...(mismatches === undefined ? {} : { mismatches }),
    ...(layout === undefined ? {} : { layout }),
  };
}

function parseTimeRef(value: unknown, path: string): TimeRef {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["unit", "origin", "originLabel"]), path);
  const originLabel = optionalString(record.originLabel, `${path}.originLabel`);
  return {
    unit: requiredEnum(record.unit, TIME_UNITS, `${path}.unit`),
    origin: requiredFiniteNumber(record.origin, `${path}.origin`),
    ...(originLabel === undefined ? {} : { originLabel }),
  };
}

function parseInterval(value: unknown, path: string): Interval {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["id", "start", "end", "label", "uncertain"]), path);
  const id = optionalString(record.id, `${path}.id`);
  const label = optionalString(record.label, `${path}.label`);
  const uncertain = optionalBoolean(record.uncertain, `${path}.uncertain`);
  return {
    start: requiredFiniteNumber(record.start, `${path}.start`),
    end: requiredFiniteNumber(record.end, `${path}.end`),
    ...(id === undefined ? {} : { id }),
    ...(label === undefined ? {} : { label }),
    ...(uncertain === undefined ? {} : { uncertain }),
  };
}

function parseTrack(value: unknown, path: string): IntervalTrack {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["id", "label", "intervals"]), path);
  return {
    id: requiredString(record.id, `${path}.id`),
    label: requiredString(record.label, `${path}.label`),
    intervals: asArray(record.intervals, `${path}.intervals`).map((interval, index) =>
      parseInterval(interval, `${path}.intervals.${index}`),
    ),
  };
}

function parseIntervalMotion(value: unknown, path: string): IntervalMotion | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["phase", "predict", "revealIds"]), path);
  const predict = optionalEnum(record.predict, PREDICT_MODES, `${path}.predict`);
  const revealIds = optionalStringArray(record.revealIds, `${path}.revealIds`);
  return {
    phase: requiredEnum(record.phase, MOTION_PHASES, `${path}.phase`),
    ...(predict === undefined ? {} : { predict }),
    ...(revealIds === undefined ? {} : { revealIds }),
  };
}

function parseAlignedIntervals(
  record: Record<string, unknown>,
  path: string,
): AlignedIntervalsSpec {
  rejectUnknownKeys(record, withBaseKeys("timeRef", "tracks", "motion", "compare"), path);
  const motion = parseIntervalMotion(record.motion, `${path}.motion`);
  let compare: AlignedIntervalsSpec["compare"];
  if (record.compare !== undefined) {
    const value = asRecord(record.compare, `${path}.compare`);
    rejectUnknownKeys(value, new Set(["kind", "tracks"]), `${path}.compare`);
    const kind = requiredEnum(value.kind, new Set(["overlap"] as const), `${path}.compare.kind`);
    const tracks = asArray(value.tracks, `${path}.compare.tracks`);
    if (tracks.length !== 2) throw new ArrangeRequestError(`${path}.compare.tracks`, "compare.tracks must contain exactly two track ids");
    compare = { kind, tracks: [requiredString(tracks[0], `${path}.compare.tracks.0`), requiredString(tracks[1], `${path}.compare.tracks.1`)] };
  }
  return {
    ...parseBase(record, path),
    timeRef: parseTimeRef(record.timeRef, `${path}.timeRef`),
    tracks: asArray(record.tracks, `${path}.tracks`).map((track, index) =>
      parseTrack(track, `${path}.tracks.${index}`),
    ),
    ...(motion === undefined ? {} : { motion }),
    ...(compare === undefined ? {} : { compare }),
  };
}

function parseScalar(value: unknown, path: string): string | number {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new ArrangeRequestError(path, `${path} must be a string or a finite number`);
}

function parseReferenceItem(value: unknown, path: string): ReferenceItem {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, new Set(["id", "label", "value", "unit", "reference"]), path);
  const unit = optionalString(record.unit, `${path}.unit`);
  const reference = optionalFiniteNumber(record.reference, `${path}.reference`);
  return {
    id: requiredString(record.id, `${path}.id`),
    label: requiredString(record.label, `${path}.label`),
    value: parseScalar(record.value, `${path}.value`),
    ...(unit === undefined ? {} : { unit }),
    ...(reference === undefined ? {} : { reference }),
  };
}

function parseValueAgainstReference(
  record: Record<string, unknown>,
  path: string,
): ValueAgainstReferenceSpec {
  rejectUnknownKeys(record, withBaseKeys("items", "frame"), path);
  const framePath = `${path}.frame`;
  const frame = asRecord(record.frame, framePath);
  rejectUnknownKeys(frame, new Set(["units", "scale"]), framePath);
  const units = optionalString(frame.units, `${framePath}.units`);
  const scale = optionalEnum(frame.scale, REFERENCE_SCALES, `${framePath}.scale`);
  const items = asArray(record.items, `${path}.items`).map((item, index) =>
    parseReferenceItem(item, `${path}.items.${index}`),
  );
  return {
    ...parseBase(record, path),
    // An empty item list is an arrangement failure, not a parse failure:
    // checkValueAgainstReference reports missing-correspondence.
    items: items as ValueAgainstReferenceSpec["items"],
    frame: {
      ...(units === undefined ? {} : { units }),
      ...(scale === undefined ? {} : { scale }),
    },
  };
}

function parseMechanismNode(value: unknown, path: string): MechanismNode {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, MECHANISM_NODE_KEYS, path);
  const note = optionalString(record.note, `${path}.note`);
  return {
    id: requiredString(record.id, `${path}.id`),
    label: requiredString(record.label, `${path}.label`),
    ...(note === undefined ? {} : { note }),
  };
}

function parseMechanismEdge(value: unknown, path: string): MechanismEdge {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, MECHANISM_EDGE_KEYS, path);
  const label = optionalString(record.label, `${path}.label`);
  return {
    from: requiredString(record.from, `${path}.from`),
    to: requiredString(record.to, `${path}.to`),
    claim: requiredEnum(record.claim, EVIDENCE_KINDS, `${path}.claim`),
    ...(label === undefined ? {} : { label }),
  };
}

function parseMechanismLayout(value: unknown, path: string): MechanismLayout {
  const record = asRecord(value, path);
  const kind = requiredEnum(record.kind, LAYOUT_KINDS, `${path}.kind`);
  if (kind === "pipeline") {
    rejectUnknownKeys(record, new Set(["kind", "order"]), path);
    return {
      kind: "pipeline",
      order: asArray(record.order, `${path}.order`).map((id, index) =>
        requiredString(id, `${path}.order.${index}`),
      ),
    };
  }
  rejectUnknownKeys(record, new Set(["kind", "layers"]), path);
  return {
    kind: "layers",
    layers: asArray(record.layers, `${path}.layers`).map((layer, index) =>
      asArray(layer, `${path}.layers.${index}`).map((id, j) =>
        requiredString(id, `${path}.layers.${index}.${j}`),
      ),
    ),
  };
}

function parseMechanismMotion(value: unknown, path: string): MechanismMotion | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, path);
  rejectUnknownKeys(record, MECHANISM_MOTION_KEYS, path);
  const revealIds = optionalStringArray(record.revealIds, `${path}.revealIds`);
  return {
    phase: requiredEnum(record.phase, MOTION_PHASES, `${path}.phase`),
    ...(revealIds === undefined ? {} : { revealIds }),
  };
}

function parseMechanismStrip(
  record: Record<string, unknown>,
  path: string,
): MechanismStripSpec {
  rejectUnknownKeys(record, withBaseKeys("nodes", "edges", "layout", "motion"), path);
  const motion = parseMechanismMotion(record.motion, `${path}.motion`);
  return {
    ...parseBase(record, path),
    nodes: asArray(record.nodes, `${path}.nodes`).map((node, index) =>
      parseMechanismNode(node, `${path}.nodes.${index}`),
    ),
    edges: asArray(record.edges, `${path}.edges`).map((edge, index) =>
      parseMechanismEdge(edge, `${path}.edges.${index}`),
    ),
    layout: parseMechanismLayout(record.layout, `${path}.layout`),
    ...(motion === undefined ? {} : { motion }),
  };
}

/** Spec type produced by parsing a portable request for each pattern id. */
export interface ArrangeSpecById {
  "point-with-context": PointWithContextSpec;
  "registered-comparison": RegisteredComparisonSpec;
  "aligned-intervals": AlignedIntervalsSpec;
  "value-against-reference": ValueAgainstReferenceSpec;
  "mechanism-strip": MechanismStripSpec;
}

export type ArrangePatternId = keyof ArrangeSpecById;

export const ARRANGE_PATTERN_IDS: readonly ArrangePatternId[] = Object.freeze([
  "point-with-context",
  "registered-comparison",
  "aligned-intervals",
  "value-against-reference",
  "mechanism-strip",
]);

export function isArrangePatternId(value: string): value is ArrangePatternId {
  return (ARRANGE_PATTERN_IDS as readonly string[]).includes(value);
}

/** Parse one pattern's spec. Views resolve against the request's asset ids. */
export function parseSpecFor<Id extends ArrangePatternId>(
  pattern: Id,
  value: unknown,
  assetIds: ReadonlySet<string>,
  path: string,
): ArrangeSpecById[Id] {
  const record = asRecord(value, path);
  switch (pattern) {
    case "point-with-context":
      return parsePointWithContext(record, assetIds, path) as ArrangeSpecById[Id];
    case "registered-comparison":
      return parseRegisteredComparison(record, assetIds, path) as ArrangeSpecById[Id];
    case "aligned-intervals":
      return parseAlignedIntervals(record, path) as ArrangeSpecById[Id];
    case "value-against-reference":
      return parseValueAgainstReference(record, path) as ArrangeSpecById[Id];
    case "mechanism-strip":
      return parseMechanismStrip(record, path) as ArrangeSpecById[Id];
    default: {
      const exhaustive: never = pattern;
      throw new ArrangeRequestError("pattern", `Unknown pattern '${String(exhaustive)}'`);
    }
  }
}
