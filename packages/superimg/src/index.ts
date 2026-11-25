//! Root `superimg` authoring entry (define build). Not the browser player graph.

export * from "./index.shared.js";

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
  planNarration,
  preparedNarrationAudio,
} from "@superimg/core/template-runtime";
export type {
  FrameProps,
  BoxProps,
  StackProps,
  TextProps,
  SafeProps,
  VectorProps,
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
} from "@superimg/core/template-runtime";

export { visual, Instance, Scene, resolveSceneTree, collectSceneSnapshots } from "@superimg/stdlib/tree";
export { svgDocument, svgDocumentIdentity, SvgArtwork, svgPart } from "@superimg/stdlib/tree";
export { NativeSurface, type PreparedNativeSurface } from "@superimg/stdlib/tree";
export type { SvgDocument, SvgPaintEdit } from "@superimg/stdlib/tree";
export type { NativeSurfaceHost, NativeSurfaceFrame, NativeSurfaceInstance, NativeSurfaceModule, PreparedNativeModuleSet } from "@superimg/types";
export { subjectSet } from "@superimg/stdlib/tree";
export type { SubjectDesign, SubjectEntity, SubjectSample, SubjectSet } from "@superimg/stdlib/tree";
export type { SubjectBinding, SubjectValue } from "@superimg/types";
export type { VisualDefinition, VisualFrame, VisualPart, InstanceProps, SpatialSceneProps, SceneProjection, SpatialSceneSnapshot, SceneBounds, ScenePosition, SceneMatrix, MediaSemantic, SceneHitRegion } from "@superimg/types";
