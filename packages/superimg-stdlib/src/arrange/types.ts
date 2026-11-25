import type { MediaElement } from "../tree/node-types.js";

/** Epistemic status of what the arrangement is showing. Painted, never collapsed. */
export type EvidenceKind =
  | "observation"
  | "derived"
  | "interpretation"
  | "proposal";

export type ArrangeFailureCode =
  | "missing-question"
  | "missing-work"
  | "missing-evidence"
  | "missing-provenance"
  | "missing-correspondence"
  | "focus-not-locatable"
  | "unaligned-frame"
  | "missing-time-ref"
  | "unsupported-claim"
  | "predict-spoils"
  | "too-dense";

export interface ArrangeFailure {
  code: ArrangeFailureCode;
  message: string;
}

export interface ArrangeSize {
  width: number;
  height: number;
}

/** Authoring contract shared by every pattern. `workRemoved` is admission, not paint. */
export interface ArrangeBase {
  question: string;
  /** What the reader no longer has to maintain or compute. */
  workRemoved: string;
  evidence: EvidenceKind;
  source?: string;
  size?: ArrangeSize;
}

export interface SrcView {
  src: string;
  fit?: "cover" | "contain" | "fill";
}

export type SpecimenView = MediaElement | SrcView;

export interface Specimen {
  id: string;
  label: string;
  view: SpecimenView;
  provenance?: string;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PointCorrespondence = "inset" | "highlight" | "panels";

export interface PointWithContextSpec extends ArrangeBase {
  context: Specimen;
  focus: Specimen & { region?: Region };
  correspondence: PointCorrespondence;
}

export interface ComparisonFrame {
  viewport?: { width: number; height: number };
  units?: string;
  crop?: string;
  timeWindow?: string;
  scale?: "shared" | "independent";
}

export interface RegisteredComparisonSpec extends ArrangeBase {
  states: [Specimen, Specimen, ...Specimen[]];
  frame: ComparisonFrame;
  /** Identities that must remain the same across states. */
  correspondence: string[];
  /** Declared, labeled differences in the frame. Silent mismatches fail. */
  mismatches?: string[];
  layout?: "side-by-side" | "stacked";
}

export type TimeUnit = "ms" | "s" | "min" | "hour" | "day";

export interface TimeRef {
  unit: TimeUnit;
  origin: number;
  originLabel?: string;
}

export interface Interval {
  id?: string;
  start: number;
  end: number;
  label?: string;
  uncertain?: boolean;
}

export interface IntervalTrack {
  id: string;
  label: string;
  intervals: Interval[];
}

/** hold = context only; predict = answer as tick/empty; reveal = full ink. */
export type IntervalMotionPhase = "hold" | "predict" | "reveal";
export type IntervalPredictMode = "tick" | "empty" | "ghost";

export interface IntervalMotion {
  phase: IntervalMotionPhase;
  /** How answer tracks appear during predict. Ghost is a faint tick, never a full-extent wash. */
  predict?: IntervalPredictMode;
  /** Track ids whose extent is the claim. Required for predict. */
  revealIds?: string[];
}

export interface AlignedIntervalsSpec extends ArrangeBase {
  timeRef: TimeRef;
  tracks: IntervalTrack[];
  compare?: { kind: "overlap"; tracks: [string, string] };
  motion?: IntervalMotion;
}

export interface ReferenceItem {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  reference?: number;
}

export interface ValueAgainstReferenceSpec extends ArrangeBase {
  items: [ReferenceItem, ...ReferenceItem[]];
  frame: {
    units?: string;
    scale?: "shared" | "per-item";
  };
}

export interface MechanismNode {
  id: string;
  label: string;
  note?: string;
}

/** `claim` is per-edge evidence — a mechanism is a chain of separately-supported steps, not one grade. */
export interface MechanismEdge {
  from: string;
  to: string;
  label?: string;
  claim: EvidenceKind;
}

export type MechanismLayout =
  | { kind: "pipeline"; order: string[] }
  | { kind: "layers"; layers: string[][] };

/** Same hold/predict/reveal vocabulary as interval motion, but revealIds address edges (`${from}->${to}`), not tracks. */
export interface MechanismMotion {
  phase: IntervalMotionPhase;
  /** Edge ids revealed in declared order. Required when phase is "predict". */
  revealIds?: string[];
}

export interface MechanismStripSpec extends ArrangeBase {
  nodes: MechanismNode[];
  edges: MechanismEdge[];
  /** No automatic graph layout — position comes only from declared order/layers. */
  layout: MechanismLayout;
  motion?: MechanismMotion;
}
