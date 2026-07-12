//! Template-facing runtime surface for `import … from "superimg"`.
//!
//! Bundlers resolve the bare `superimg` specifier to this module so templates
//! get real ESM (define / compose / scene) instead of string-inlined JS.

export { define, defineConfig, defineBatch } from "@superimg/types";
export { compose } from "./composition/compose.js";
export { scene } from "./composition/scene.js";
/** Pure seconds → percent phases + totalSeconds (resolve + render). */
export { layoutTimeline, type LayoutTimelineResult } from "@superimg/stdlib/layout-timeline";
