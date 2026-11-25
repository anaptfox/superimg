//! Template-facing runtime surface for `import … from "@foxworth/superimg"`.
//!
//! Bundlers resolve the bare `superimg` specifier to this module so templates
//! get real ESM authoring helpers instead of string-inlined JS.

export {
  define,
  defineConfig,
  video,
  image,
  svg,
  ogImage,
  collection,
  googleFont,
} from "@superimg/types";
export { compose } from "./composition/compose.js";
export { sequence } from "./composition/sequence.js";
export { choose } from "./composition/choose.js";
export { together } from "./composition/together.js";
export { time } from "./composition/time.js";
export { rebaseCompositionSources } from "./composition/rebase.js";
export { replaceOccurrence } from "./composition/replace.js";
export { diffCompositionSchedules } from "./composition/diff.js";
export { source } from "./source.js";
export { svgDocument, svgDocumentIdentity, SvgArtwork, svgPart } from "@superimg/stdlib/tree";
export { NativeSurface } from "@superimg/stdlib/tree";
export type { SvgDocument, SvgPaintEdit } from "@superimg/stdlib/tree";
export type { SourceInput, SourceFit, SourceImageOptions, SourceVideoOptions } from "./source.js";
export { preparedNarrationAudio, planNarration } from "./shared/narration-plan.js";
/** Pure seconds → percent phases + totalSeconds (resolve + render). */
export { layoutTimeline, type LayoutTimelineResult } from "@superimg/stdlib/layout-timeline";
export { arrange, ArrangeError } from "@superimg/stdlib/arrange";
export type {
  AlignedIntervalsSpec,
  ArrangeFailure,
  EvidenceKind,
  PointWithContextSpec,
  RegisteredComparisonSpec,
} from "@superimg/stdlib/arrange";
export { isMediaElement, MEDIA_ELEMENT } from "@superimg/types";
export type {
  MediaNode,
  MediaElement,
  MediaChild,
  MediaProps,
  MediaAttributes,
  MediaStylePropertyValue,
  MediaStyleObject,
  MediaMotionValue,
  MediaStyleValue,
  MediaLayout,
  RenderOutput,
} from "@superimg/types";
export {
  h,
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
  lower,
  walkMediaTree,
} from "@superimg/stdlib/tree";
export type {
  FrameProps,
  BoxProps,
  StackProps,
  TextProps,
  SafeProps,
  VectorAttributes,
  VectorPaintProps,
  VectorCircleProps,
  VectorRectProps,
  VectorViewportProps,
  VectorImageProps,
  VectorLinearGradientProps,
  VectorStopProps,
  VectorPatternProps,
  VectorFilterProps,
  VectorGaussianBlurProps,
  VectorMergeNodeProps,
  VectorTurbulenceProps,
  VectorDisplacementMapProps,
  VectorProps,
  VectorViewBox,
  VectorTransform,
  VectorTransformValue,
  VectorGroupProps,
  VectorPathProps,
  VectorDefsProps,
  VectorMaskProps,
  VectorClipProps,
  VectorTextProps,
  VectorRunProps,
  SpacerProps,
  FillProps,
  FillGradient,
  ImageProps,
  VideoProps,
  PlateProps,
  HtmlProps,
  CodeProps,
  PadValue,
  TextVariant,
  TreeNodeSemantics,
  TreeMotionSample,
  TreeNamespace,
  TreeBounds,
  TreePaint,
  TreeGeometry,
  TreeRelations,
} from "@superimg/stdlib/tree";

export { visual, Instance, Scene, resolveSceneTree, collectSceneSnapshots } from "@superimg/stdlib/tree";
export { subjectSet } from "@superimg/stdlib/tree";
export type { SubjectDesign, SubjectEntity, SubjectSample, SubjectSet } from "@superimg/stdlib/tree";
export type { SubjectBinding, SubjectValue } from "@superimg/types";
export type { VisualDefinition, VisualFrame, VisualPart, InstanceProps, SpatialSceneProps, SceneProjection, SpatialSceneSnapshot, SceneBounds, ScenePosition, SceneMatrix, MediaSemantic, SceneHitRegion } from "@superimg/types";
