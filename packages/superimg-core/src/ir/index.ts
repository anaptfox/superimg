//! Media IR pure surface (browser-safe — no Node fs).

export * from "./pure/index.js";
export {
  timelineFromMediaIR,
  seekFrameForTimelineItem,
  itemsAtFrame,
  formatLaneItemHover,
  formatFrameAsSeconds,
  clampPlayheadFrame,
  type TimelineProjectionOptions,
  type TimelineLaneKind,
  type TimelineCapability,
  type TimelineLaneItem,
  type TimelineLane,
  type MultiTrackTimeline,
} from "./pure/timeline.js";
export * from "./instrument.js";
export {
  resolveMediaIR,
  resolveMediaIRFromBundle,
  normalizeSourceId,
  type ResolveMediaIROptions,
  type ResolveMediaIRResult,
} from "./resolve-media-ir.js";
export { attachIrSink, getIrSink, IR_SINK } from "./sink-symbol.js";

export { shouldFailMediaDiff, type MediaDiffFailOn } from "./pure/comparison.js";
export { parseSelector, matchId, classifyExpectedChanges, type SelectorKind, type ParsedSelector } from "./pure/change-selectors.js";
export { diffSemantics, type InspectDiff } from "./pure/semantic-diff.js";
