//! Re-export pure IR→timeline projection from @superimg/core (shared with Studio).
//! Prefer: import { timelineFromMediaIR } from "@superimg/player/timeline" or this package root.

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
