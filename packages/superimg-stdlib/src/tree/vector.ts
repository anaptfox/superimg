//! Semantic SVG authoring nodes. `Vector` bridges layout into an SVG namespace;
//! the namespaced factories retain native SVG concepts without widening the
//! top-level primitive catalog.

import type { MediaChild, MediaElement, MediaProps } from "./node-types.js";
import { h, isMediaElement } from "./h.js";
import type { BoxProps } from "./primitives.js";

export interface VectorViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VectorTransform {
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  originX?: number;
  originY?: number;
}

export type VectorTransformValue = string | VectorTransform;

export type VectorAspectAlignment = `x${"Min" | "Mid" | "Max"}Y${"Min" | "Mid" | "Max"}`;
export type VectorAspectRatio = "none" | VectorAspectAlignment | `${VectorAspectAlignment} ${"meet" | "slice"}`;

export interface VectorProps extends BoxProps, VectorAttributes {
  viewBox?: VectorViewBox;
  fit?: "contain" | "cover" | "fill";
  /** Exact SVG viewport alignment; takes precedence over fit when supplied. */
  preserveAspectRatio?: VectorAspectRatio;
}

export interface VectorAttributes extends MediaProps {
  role?: string;
  [attribute: `data-${string}`]: string | number | undefined;
  [attribute: `aria-${string}`]: string | number | boolean | undefined;
}

interface VectorReferenceProps extends VectorAttributes {
  /** Plain definition id, without `#` or `url(...)`. */
  mask?: string;
  /** Plain definition id, without `#` or `url(...)`. */
  clip?: string;
  filter?: string;
}

export interface VectorGroupProps extends VectorPaintProps {
  transform?: VectorTransformValue;
  opacity?: number;
}

export interface VectorPaintProps extends VectorReferenceProps {
  fill?: string;
  fillOpacity?: number;
  fillRule?: "nonzero" | "evenodd";
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  strokeDasharray?: string | number;
  strokeDashoffset?: string | number;
  /** Keep stroke widths in viewport units when geometry is transformed. */
  vectorEffect?: "none" | "non-scaling-stroke";
  opacity?: number;
  transform?: VectorTransformValue;
  shapeRendering?: "auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision";
}

export type VectorPoint =
  | readonly [number, number]
  | { readonly x: number; readonly y: number };

export type VectorPointsValue = string | ReadonlyArray<VectorPoint>;

export function formatVectorPoints(points: VectorPointsValue): string {
  if (typeof points === "string") return points;
  return points
    .map((point) =>
      Array.isArray(point)
        ? `${point[0]},${point[1]}`
        : `${(point as { readonly x: number; readonly y: number }).x},${(point as { readonly x: number; readonly y: number }).y}`,
    )
    .join(" ");
}

export interface VectorPathProps extends VectorPaintProps {
  d: string;
  pathLength?: number;
}

export interface VectorCircleProps extends VectorPaintProps {
  cx: number;
  cy: number;
  r: number;
}

export interface VectorRectProps extends VectorPaintProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

export interface VectorLineProps extends VectorPaintProps {
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
}

export interface VectorEllipseProps extends VectorPaintProps {
  cx?: number | string;
  cy?: number | string;
  rx: number | string;
  ry: number | string;
}

export interface VectorPolylineProps extends VectorPaintProps {
  points: VectorPointsValue;
}

export interface VectorPolygonProps extends VectorPaintProps {
  points: VectorPointsValue;
}

/** Native SVG `<image>` inside a `Vector` tree (cutouts, sprites, photos). */
export interface VectorImageProps extends VectorReferenceProps {
  href: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  fit?: "contain" | "cover" | "fill";
  preserveAspectRatio?: VectorAspectRatio;
  opacity?: number;
  transform?: VectorTransformValue;
  imageRendering?: "auto" | "optimizeSpeed" | "optimizeQuality" | "pixelated";
}

/** Native nested SVG viewport; coordinates belong to the enclosing viewBox. */
export interface VectorViewportProps extends VectorPaintProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  viewBox: VectorViewBox;
  fit?: "contain" | "cover" | "fill";
  preserveAspectRatio?: VectorAspectRatio;
}

export interface VectorLinearGradientProps extends VectorAttributes {
  id: string;
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  gradientUnits?: "objectBoundingBox" | "userSpaceOnUse";
}

export interface VectorRadialGradientProps extends VectorAttributes {
  id: string;
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
  fx?: number | string;
  fy?: number | string;
  fr?: number | string;
  gradientUnits?: "objectBoundingBox" | "userSpaceOnUse";
  gradientTransform?: string;
  spreadMethod?: "pad" | "reflect" | "repeat";
}

export interface VectorStopProps extends VectorAttributes {
  offset?: number | string;
  stopColor: string;
  stopOpacity?: number;
}

export interface VectorPatternProps extends VectorAttributes {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  patternUnits?: "objectBoundingBox" | "userSpaceOnUse";
}

export interface VectorFilterProps extends VectorAttributes {
  id: string;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  filterUnits?: "objectBoundingBox" | "userSpaceOnUse";
}

export interface VectorGaussianBlurProps extends VectorAttributes {
  in?: string;
  stdDeviation: number;
  result?: string;
}

export interface VectorMergeNodeProps extends VectorAttributes { in: string; }

export interface VectorTurbulenceProps extends VectorAttributes {
  type?: "fractalNoise" | "turbulence";
  baseFrequency: number | string;
  numOctaves?: number;
  seed?: number;
  result?: string;
}

export interface VectorDisplacementMapProps extends VectorAttributes {
  in: string;
  in2: string;
  scale?: number;
  xChannelSelector?: "R" | "G" | "B" | "A";
  yChannelSelector?: "R" | "G" | "B" | "A";
  result?: string;
}

export interface VectorDefsProps extends Pick<MediaProps, "key"> {}

export interface VectorMaskProps extends Pick<MediaProps, "key" | "style" | "motion"> {
  id: string;
  mode?: "alpha" | "luminance";
}

export interface VectorClipProps extends Pick<MediaProps, "key" | "style" | "motion"> {
  id: string;
}

export interface VectorTextProps extends VectorReferenceProps {
  x: number;
  y: number;
  fill?: string;
  fillOpacity?: number;
  opacity?: number;
  size?: number;
  family?: string;
  weight?: number | string;
  anchor?: "start" | "middle" | "end";
  dominantBaseline?: "auto" | "middle" | "central" | "hanging" | "text-before-edge" | "text-after-edge";
  letterSpacing?: number | string;
  transform?: VectorTransformValue;
  /** Character reveal progress (0..1) for typewriter / progressive text reveal. */
  reveal?: number;
}

export interface VectorRunProps extends Pick<MediaProps, "id" | "key" | "style" | "motion"> {
  x?: number;
  y?: number;
  dx?: number | string;
  dy?: number | string;
  fill?: string;
  fillOpacity?: number;
  opacity?: number;
  size?: number;
  family?: string;
  weight?: number | string;
  styleName?: "normal" | "italic" | "oblique";
  letterSpacing?: number | string;
}

function isPropsBag(value: unknown): value is MediaProps {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !isMediaElement(value);
}

function split<P extends MediaProps>(
  propsOrChild: P | MediaChild | undefined,
  rest: MediaChild[],
): { props: P; children: MediaChild[] } {
  if (propsOrChild === undefined) return { props: {} as P, children: rest };
  if (isPropsBag(propsOrChild)) return { props: propsOrChild as P, children: rest };
  return { props: {} as P, children: [propsOrChild, ...rest] };
}

export function Vector(
  propsOrChild?: VectorProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"Vector", VectorProps> {
  const { props, children } = split<VectorProps>(propsOrChild, rest);
  return h<"Vector", VectorProps>(
    "Vector",
    { width: "fill", height: "fill", overflow: "hidden", fit: "contain", ...props },
    ...children,
  );
}

function group(
  propsOrChild?: VectorGroupProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"VectorGroup", VectorGroupProps> {
  const { props, children } = split<VectorGroupProps>(propsOrChild, rest);
  return h("VectorGroup", props, ...children);
}

function path(props: VectorPathProps): MediaElement<"VectorPath", VectorPathProps> {
  return h("VectorPath", props);
}

function defs(...children: MediaChild[]): MediaElement<"VectorDefs", VectorDefsProps> {
  return h("VectorDefs", {}, ...children);
}

function mask(
  props: VectorMaskProps,
  ...children: MediaChild[]
): MediaElement<"VectorMask", VectorMaskProps> {
  return h("VectorMask", props, ...children);
}

function clip(
  props: VectorClipProps,
  ...children: MediaChild[]
): MediaElement<"VectorClip", VectorClipProps> {
  return h("VectorClip", props, ...children);
}

function text(
  props: VectorTextProps,
  ...children: MediaChild[]
): MediaElement<"VectorText", VectorTextProps> {
  return h("VectorText", props, ...children);
}

function run(
  propsOrChild?: VectorRunProps | MediaChild,
  ...rest: MediaChild[]
): MediaElement<"VectorRun", VectorRunProps> {
  const { props, children } = split<VectorRunProps>(propsOrChild, rest);
  return h("VectorRun", props, ...children);
}

function native<T extends string, P extends MediaProps>(type: T) {
  return (props: P, ...children: MediaChild[]): MediaElement<T, P> => h(type, props, ...children);
}

const circle = native<"VectorCircle", VectorCircleProps>("VectorCircle");
const rect = native<"VectorRect", VectorRectProps>("VectorRect");
const line = native<"VectorLine", VectorLineProps>("VectorLine");
const ellipse = native<"VectorEllipse", VectorEllipseProps>("VectorEllipse");
const polyline = (
  props: VectorPolylineProps,
  ...children: MediaChild[]
): MediaElement<"VectorPolyline", VectorPolylineProps> =>
  h<"VectorPolyline", VectorPolylineProps>("VectorPolyline", { ...props, points: formatVectorPoints(props.points) }, ...children);
const polygon = (
  props: VectorPolygonProps,
  ...children: MediaChild[]
): MediaElement<"VectorPolygon", VectorPolygonProps> =>
  h<"VectorPolygon", VectorPolygonProps>("VectorPolygon", { ...props, points: formatVectorPoints(props.points) }, ...children);
const viewport = native<"VectorViewport", VectorViewportProps>("VectorViewport");
const image = native<"VectorImage", VectorImageProps>("VectorImage");
const linearGradient = native<"VectorLinearGradient", VectorLinearGradientProps>("VectorLinearGradient");
const radialGradient = native<"VectorRadialGradient", VectorRadialGradientProps>("VectorRadialGradient");
const stop = native<"VectorStop", VectorStopProps>("VectorStop");
const pattern = native<"VectorPattern", VectorPatternProps>("VectorPattern");
const filter = native<"VectorFilter", VectorFilterProps>("VectorFilter");
const gaussianBlur = native<"VectorGaussianBlur", VectorGaussianBlurProps>("VectorGaussianBlur");
const mergeNode = native<"VectorMergeNode", VectorMergeNodeProps>("VectorMergeNode");
const turbulence = native<"VectorTurbulence", VectorTurbulenceProps>("VectorTurbulence");
const displacementMap = native<"VectorDisplacementMap", VectorDisplacementMapProps>("VectorDisplacementMap");
const merge = (...children: MediaChild[]) => h("VectorMerge", {}, ...children);

export const vector = {
  circle, rect, line, ellipse, polyline, polygon,
  viewport, image, linearGradient, radialGradient, stop, pattern, filter, gaussianBlur,
  merge, mergeNode, turbulence, displacementMap,
  group,
  path,
  defs,
  mask,
  clip,
  text,
  run,
} as const;

export const VECTOR_NODE_TYPES = new Set([
  "VectorCircle", "VectorRect", "VectorLine", "VectorEllipse", "VectorPolyline", "VectorPolygon",
  "VectorViewport", "VectorImage", "VectorLinearGradient", "VectorRadialGradient",
  "VectorStop", "VectorPattern", "VectorFilter", "VectorGaussianBlur",
  "VectorMerge", "VectorMergeNode", "VectorTurbulence", "VectorDisplacementMap",
  "Vector",
  "VectorGroup",
  "VectorPath",
  "VectorDefs",
  "VectorMask",
  "VectorClip",
  "VectorText",
  "VectorRun",
]);
