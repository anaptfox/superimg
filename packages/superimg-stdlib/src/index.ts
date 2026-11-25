/**
 * SuperImg Standard Library
 *
 * Re-exports all modules for convenience.
 * Individual modules can also be imported directly:
 *
 * @example
 * import { easeOutCubic } from '@foxworth/superimg/stdlib/easing';
 * import { lerp } from '@foxworth/superimg/stdlib/math';
 */

export * from "./easing";
export * from "./math";
export * from "./color";
export * from "./date";
export * from "./text";
export * from "./css";
export * from "./responsive";
export * from "./subtitle";
export * from "./code";
export { createDirector, layoutPhases, mergeMotion, type PhaseConfig, type MotionEasing, type MotionOpts,
  type MotionResult, type MotionValue, type TweenOpts, type ValueOpts, type ValueResult,
  type BeatsOpts, type BeatState,
  type Director, type DirectorOf, type DirectorContext, type DirectorOpts, type ClipOpts, type DirectorClip,
  type NormalizedPhase, type SemanticEasing } from "./director.js";
export { carousel, type Carousel, type CarouselOpts, type CarouselItemState } from "./carousel.js";
export { stack, stackSlotWindows, type StackOpts, type StackItemState } from "./stack.js";
export type { Stack as StackWidget } from "./stack.js";
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
export * from "./safe-area";
export {
  h,
  lower,
  lowerSvg,
  needsBrowser,
  layoutTree,
  walkMediaTree,
  Frame,
  Stack,
  Text,
  Safe,
  Vector,
  vector,
  Code,
  Spacer,
  Fill,
  Image,
  Video,
  Plate,
  Html,
  type LowerOptions,
  type LowerSvgOptions,
  type BrowserReason,
  type NeedsBrowserConfig,
  type NeedsBrowserResult,
  type FrameProps,
  type BoxProps,
  type StackProps,
  type TextProps,
  type SafeProps,
  type VectorPoint,
  type VectorPointsValue,
  formatVectorPoints,
  type VectorAttributes,
  type VectorPaintProps,
  type VectorCircleProps,
  type VectorRectProps,
  type VectorLineProps,
  type VectorEllipseProps,
  type VectorPolylineProps,
  type VectorPolygonProps,
  type VectorViewportProps,
  type VectorLinearGradientProps,
  type VectorRadialGradientProps,
  type VectorStopProps,
  type VectorPatternProps,
  type VectorFilterProps,
  type VectorGaussianBlurProps,
  type VectorMergeNodeProps,
  type VectorTurbulenceProps,
  type VectorDisplacementMapProps,
  type VectorProps,
  type VectorViewBox,
  type VectorTransform,
  type VectorTransformValue,
  type VectorGroupProps,
  type VectorPathProps,
  type VectorDefsProps,
  type VectorMaskProps,
  type VectorClipProps,
  type VectorTextProps,
  type VectorRunProps,
  type CodeProps,
  type SpacerProps,
  type FillProps,
  type FillGradient,
  type ImageProps,
  type VideoProps,
  type PlateProps,
  type HtmlProps,
  type PadValue,
  type TextVariant,
  type TreeNodeSemantics,
  type TreeMotionSample,
  type TreeNamespace,
  type TreeBounds,
  type TreePaint,
  type TreeGeometry,
  type TreeRelations,
} from "./tree/index.js";
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
export {
  arrange,
  ArrangeError,
  alignedIntervals,
  checkAlignedIntervals,
  checkPointWithContext,
  checkRegisteredComparison,
  checkValueAgainstReference,
  pointWithContext,
  registeredComparison,
  valueAgainstReference,
} from "./arrange/index.js";
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
} from "./arrange/index.js";

export { visual, Instance, Scene, resolveSceneTree, collectSceneSnapshots } from "./tree/scene.js";
export { subjectSet } from "./tree/subjects.js";
export type { SubjectDesign, SubjectEntity, SubjectSample, SubjectSet } from "./tree/subjects.js";
export type { SubjectBinding, SubjectValue } from "./scene-types.js";
