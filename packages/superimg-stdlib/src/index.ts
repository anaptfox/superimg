/**
 * SuperImg Standard Library
 *
 * Re-exports all modules for convenience.
 * Individual modules can also be imported directly:
 *
 * @example
 * import { easeOutCubic } from 'superimg/stdlib/easing';
 * import { lerp } from 'superimg/stdlib/math';
 */

export * from "./easing";
export * from "./math";
export * from "./color";
export * from "./date";
export * from "./text";
export * from "./css";
export * from "./responsive";
export * from "./subtitle";
export * from "./presets";
export * from "./code";
export { createDirector, layoutPhases, mergeMotion, type PhaseConfig, type MotionEasing, type MotionOpts,
  type MotionResult, type MotionValue, type TweenOpts, type ValueOpts, type ValueResult,
  type Director, type DirectorOf, type DirectorContext, type DirectorOpts, type ClipOpts, type DirectorClip,
  type NormalizedPhase, type SemanticEasing } from "./director.js";
export { carousel, type Carousel, type CarouselOpts, type CarouselItemState } from "./carousel.js";
export { stack, stackSlotWindows, type Stack, type StackOpts, type StackItemState } from "./stack.js";
export { layoutTimeline, type LayoutTimelineResult } from "./layout-timeline.js";
export { createTrack, type Track, type TrackSource } from "./track.js";
export * from "./backgrounds";
export * from "./montage";
export * from "./spring";
export {
  stagger,
  staggerLead,
  staggerPlan,
  type StaggerItem,
  type StaggerLeadOptions,
  type StaggerMsOptions,
  type StaggerPlan,
  type StaggerOptions,
} from "./stagger";
export * from "./timing";
export * from "./phase-recipes";
export * from "./motion-presets";
export * from "./interpolate";
export * from "./path";
export * from "./svg";
export * as layout from "./layout";
export * from "./layers";
export * from "./safe-area";
export type { DirectorOpts } from "./director.js";
export { sync as videoSync, quantizeVideoTime, CLIP_SYNC_ATTR, type ClipSyncOptions, type ClipSyncResult } from "./video";
export {
  video as mediaVideo,
  youtube as mediaYoutube,
  extractYoutubeId,
  MEDIA_ATTR,
  EXTERNAL_EMBED_ATTR,
  type MediaFit,
  type MediaVideoOptions,
  type MediaYoutubeOptions,
  type MediaVideoResult,
  type MediaYoutubeResult,
} from "./media";
export { revealFx as reveal } from "./reveal";
export {
  ready,
  token as readyToken,
  done as readyDone,
  fail as readyFail,
  WAIT_ATTR as READY_WAIT_ATTR,
  type ReadyToken,
} from "./ready.js";
export { oscillate, loop, pingpong, wiggle,
  type OscillateOpts, type LoopOpts, type WiggleOpts } from "./oscillate";
