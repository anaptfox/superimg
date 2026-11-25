//! Browser-safe retained-composition authoring surface.
//!
//! Keep this separate from the broad core barrel: template authors need these
//! pure constructors without inheriting runtime capability preparation.

export { compose } from "./composition/compose.js";
export { sequence } from "./composition/sequence.js";
export { choose } from "./composition/choose.js";
export { together } from "./composition/together.js";
export { time, interactiveCompositionRuntimes } from "./composition/time.js";
export { rebaseCompositionSources } from "./composition/rebase.js";
export type { CompositionSourceBases } from "./composition/rebase.js";
export { replaceOccurrence } from "./composition/replace.js";
export { diffCompositionSchedules } from "./composition/diff.js";
export type { CompositionScheduleDiff, ScheduleRangeChange } from "./composition/diff.js";
