export { h, isMediaElement, MEDIA_ELEMENT } from "./h.js";
export type { MediaChild, MediaElement } from "./node-types.js";
export { lower, type LowerOptions } from "./lower.js";
export { lowerSvg, type LowerSvgOptions } from "./lower-svg.js";
export { needsBrowser, type BrowserReason, type NeedsBrowserConfig, type NeedsBrowserResult } from "./classify.js";
export { layoutTree, layoutElement, PRIMITIVE_TYPES } from "./layout.js";
export {
  Frame,
  Stack,
  Text,
  DEFAULT_TEXT_COLOR,
  Safe,
  Spacer,
  Fill,
  Image,
  Video,
  Plate,
  Html,
  type FrameProps,
  type StackProps,
  type TextProps,
  type SafeProps,
  type BoxProps,
  type SpacerProps,
  type FillProps,
  type FillGradient,
  type ImageProps,
  type VideoProps,
  type PlateProps,
  type HtmlProps,
  type PadValue,
  type TextVariant,
} from "./primitives.js";
export {
  Vector,
  vector,
  VECTOR_NODE_TYPES,
  formatVectorPoints,
  type VectorPoint,
  type VectorPointsValue,
  type VectorAttributes,
  type VectorPaintProps,
  type VectorCircleProps,
  type VectorRectProps,
  type VectorLineProps,
  type VectorEllipseProps,
  type VectorPolylineProps,
  type VectorPolygonProps,
  type VectorViewportProps,
  type VectorImageProps,
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
} from "./vector.js";
export { Code, type CodeProps } from "./code-node.js";

export {
  walkMediaTree,
  type TreeNodeSemantics,
  type TreeMotionSample,
  type TreeNamespace,
  type TreeBounds,
  type TreePaint,
  type TreeGeometry,
  type TreeRelations,
} from "./walk.js";

export { visual, Instance, Scene, resolveSceneTree, collectSceneDescriptions, collectSceneSnapshots, multiplySceneMatrices, transformScenePoint, placeSceneSnapshot, transformSceneBounds } from "./scene.js";
export { subjectSet } from "./subjects.js";
export { svgDocument, svgDocumentIdentity, SvgArtwork, svgPart } from "../svg/document-artwork.js";
export { NativeSurface, type PreparedNativeSurface } from "./native-surface.js";
export type { SvgDocument } from "../svg/document-artwork.js";
export type { SvgPaintEdit } from "../svg/document-tree.js";
export type { SubjectDesign, SubjectEntity, SubjectSample, SubjectSet } from "./subjects.js";
export type { SubjectBinding, SubjectValue } from "../scene-types.js";
export type { ResolveSceneOptions } from "./scene.js";
