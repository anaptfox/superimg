//! Re-export shared pure timeline model (no private fork).
//! Source of truth: packages/superimg-core/src/ir/pure/timeline.ts
//! Also available as `@superimg/player/timeline` and `@foxworth/superimg/ir`.

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
} from "@superimg/core/ir";
