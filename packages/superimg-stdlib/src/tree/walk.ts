import { collectSceneSnapshots } from "./scene.js";
//! Walk a laid-out media tree for inspect / spatial semantics.

import type { MediaChild, MediaElement, MediaLayout, MediaNode } from "./node-types.js";
import { layoutTree, layoutInfo, PRIMITIVE_TYPES, type LayoutOptions } from "./layout.js";
import { typographyForPaint } from "./typography.js";
import { isMediaElement } from "./h.js";
import { bounds as pathBounds } from "../svg/bezier.js";
import { inheritedVectorStyle, vectorTextContent, vectorTextMetrics, type VectorInheritedStyle } from "./vector-typography.js";
import type { TextMeasurer } from "../svg/measure.js";

export interface TreeMotionSample {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  phase: string;
}

export type TreeNamespace = "html" | "svg";

export interface TreeBounds extends MediaLayout {
  /** True when bounds come from sampled path/text geometry. */
  estimated?: boolean;
}

export interface TreePaint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  vectorEffect?: "none" | "non-scaling-stroke";
  opacity?: number;
  fillOpacity?: number;
  complex?: boolean;
}

export interface TreeGeometry {
  kind: "path";
  d: string;
  valid: boolean;
  error?: string;
}

export interface TreeRelations {
  mask?: string;
  clip?: string;
  filter?: string;
  references: readonly string[];
}

export interface TreeNodeSemantics {
  id?: string;
  tag: string;
  role?: string;
  text?: string;
  layout?: MediaLayout;
  color?: string;
  childCount: number;
  motion?: TreeMotionSample;
  path?: string;
  parentPath?: string;
  depth?: number;
  namespace?: TreeNamespace;
  directText?: string;
  bounds?: TreeBounds;
  paint?: TreePaint;
  geometry?: TreeGeometry;
  relations?: TreeRelations;
  opaque?: boolean;
  /** False when this Text used the 0.55em width heuristic. */
  metricsExact?: boolean;
  fontFamily?: string;
  typography?: { fontSize: number; fontFamily: string; fontWeight: number; metricsSource: "font" | "heuristic"; anchor?: string; dominantBaseline?: string };
  spatial?: { bounds: MediaLayout; supported: boolean; clip?: MediaLayout; hidden: boolean };
  textGeometry?: { lines: readonly { text: string; bounds: MediaLayout }[]; content: MediaLayout; parentContent: MediaLayout; constraints: { width: boolean; height: boolean }; metrics: "font" | "heuristic"; flow: readonly { stack: string; item: string }[]; supported: boolean; clipped: boolean; transient: boolean };
  layoutRole?: "root" | "flow" | "layer";
}

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function translate(x: number, y: number): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function scale(x: number, y: number): Matrix {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

function rotate(degrees: number, originX = 0, originY = 0): Matrix {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotation = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  return multiply(
    translate(originX, originY),
    multiply(rotation, translate(-originX, -originY)),
  );
}

function transformMatrix(value: unknown): Matrix {
  if (typeof value === "string") {
    let result = IDENTITY;
    const pattern = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
    for (const match of value.matchAll(pattern)) {
      const values = (match[2] ?? "")
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      let next = IDENTITY;
      if (match[1] === "matrix" && values.length >= 6 && values.slice(0, 6).every(Number.isFinite)) {
        next = {
          a: values[0]!, b: values[1]!, c: values[2]!,
          d: values[3]!, e: values[4]!, f: values[5]!,
        };
      } else if (match[1] === "translate" && Number.isFinite(values[0])) {
        next = translate(values[0]!, Number.isFinite(values[1]) ? values[1]! : 0);
      } else if (match[1] === "scale" && Number.isFinite(values[0])) {
        next = scale(values[0]!, Number.isFinite(values[1]) ? values[1]! : values[0]!);
      } else if (match[1] === "rotate" && Number.isFinite(values[0])) {
        next = rotate(
          values[0]!,
          Number.isFinite(values[1]) ? values[1]! : 0,
          Number.isFinite(values[2]) ? values[2]! : 0,
        );
      }
      result = multiply(result, next);
    }
    return result;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return IDENTITY;
  const t = value as Record<string, unknown>;
  const x = num(t.x) ?? 0;
  const y = num(t.y) ?? 0;
  const uniform = num(t.scale);
  const sx = num(t.scaleX) ?? uniform ?? 1;
  const sy = num(t.scaleY) ?? uniform ?? 1;
  const angle = num(t.rotate) ?? 0;
  const ox = num(t.originX) ?? 0;
  const oy = num(t.originY) ?? 0;
  return multiply(translate(x, y), multiply(rotate(angle, ox, oy), scale(sx, sy)));
}

function mapPoint(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function mapBounds(bounds: TreeBounds, matrix: Matrix): TreeBounds {
  const points = [
    mapPoint(matrix, bounds.x, bounds.y),
    mapPoint(matrix, bounds.x + bounds.width, bounds.y),
    mapPoint(matrix, bounds.x, bounds.y + bounds.height),
    mapPoint(matrix, bounds.x + bounds.width, bounds.y + bounds.height),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    ...(bounds.estimated ? { estimated: true } : {}),
  };
}

function mergeBounds(values: readonly (TreeBounds | undefined)[]): TreeBounds | undefined {
  const bounds = values.filter((value): value is TreeBounds => value !== undefined);
  if (bounds.length === 0) return undefined;
  const minX = Math.min(...bounds.map((value) => value.x));
  const minY = Math.min(...bounds.map((value) => value.y));
  const maxX = Math.max(...bounds.map((value) => value.x + value.width));
  const maxY = Math.max(...bounds.map((value) => value.y + value.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    ...(bounds.some((value) => value.estimated) ? { estimated: true } : {}),
  };
}

function vectorViewMatrix(el: MediaElement): Matrix {
  const layout = el.type === "VectorViewport"
    ? { x: num(el.props.x) ?? 0, y: num(el.props.y) ?? 0, width: num(el.props.width) ?? 0, height: num(el.props.height) ?? 0 }
    : el.layout ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const raw = el.props.viewBox;
  const view = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : undefined;
  const vx = num(view?.x) ?? 0;
  const vy = num(view?.y) ?? 0;
  const vw = Math.max(1e-9, num(view?.width) ?? layout.width);
  const vh = Math.max(1e-9, num(view?.height) ?? layout.height);
  const sx = layout.width / vw;
  const sy = layout.height / vh;
  if (el.props.fit === "fill") {
    return { a: sx, b: 0, c: 0, d: sy, e: layout.x - vx * sx, f: layout.y - vy * sy };
  }
  const uniform = el.props.fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  return {
    a: uniform,
    b: 0,
    c: 0,
    d: uniform,
    e: layout.x + (layout.width - vw * uniform) / 2 - vx * uniform,
    f: layout.y + (layout.height - vh * uniform) / 2 - vy * uniform,
  };
}

function isMotionResult(value: unknown): value is TreeMotionSample & { style: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { style?: unknown }).style === "string" &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number" &&
    typeof (value as { scale?: unknown }).scale === "number" &&
    typeof (value as { rotate?: unknown }).rotate === "number" &&
    typeof (value as { opacity?: unknown }).opacity === "number" &&
    typeof (value as { phase?: unknown }).phase === "string"
  );
}

function childText(el: MediaElement): string {
  const parts: string[] = [];
  const walk = (child: MediaChild): void => {
    if (typeof child === "string" || typeof child === "number") parts.push(String(child));
    else if (Array.isArray(child)) child.forEach(walk);
    else if (isMediaElement(child)) child.children.forEach(walk);
  };
  el.children.forEach(walk);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function directText(el: MediaElement): string {
  return el.children
    .flatMap((child) => typeof child === "string" || typeof child === "number" ? [String(child)] : [])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorOf(el: MediaElement): string | undefined {
  if (typeof el.props.color === "string") return el.props.color;
  if (typeof el.props.fill === "string") return el.props.fill;
  const style = el.props.style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    const color = (style as Record<string, unknown>).color;
    if (typeof color === "string") return color;
  }
  return undefined;
}

function visibleChildCount(el: MediaElement): number {
  let count = 0;
  for (const child of el.children) {
    if (isMediaElement(child)) count += 1;
    else if (typeof child === "string" && child.trim()) count += 1;
    else if (typeof child === "number") count += 1;
  }
  return count;
}

function paintOf(el: MediaElement): TreePaint | undefined {
  const strokeWidth = num(el.props.strokeWidth);
  const style = el.props.style;
  const styleObject = style && typeof style === "object" && !Array.isArray(style) ? style as Record<string, unknown> : undefined;
  const motion = el.props.motion && typeof el.props.motion === "object" ? el.props.motion as unknown as Record<string, unknown> : undefined;
  const styleOpacity = typeof style === "string" ? /(?:^|;)\s*opacity\s*:\s*(\d*\.?\d+)\s*(?:;|$)/i.exec(style)?.[1] : undefined;
  const objectOpacity = typeof styleObject?.opacity === "string" && /^\d*\.?\d+$/.test(styleObject.opacity) ? Number(styleObject.opacity) : num(styleObject?.opacity);
  const authoredOpacity = num(el.props.opacity) ?? objectOpacity ?? (styleOpacity === undefined ? undefined : Number(styleOpacity));
  const motionOpacity = num(motion?.opacity);
  const opacity = authoredOpacity === undefined ? motionOpacity : authoredOpacity * (motionOpacity ?? 1);
  const paint: TreePaint = {
    ...(el.type === "Fill" && typeof el.props.color === "string" ? { fill: el.props.color } : {}),
    ...(typeof el.props.fill === "string" ? { fill: el.props.fill } : {}),
    ...(typeof el.props.stroke === "string" ? { stroke: el.props.stroke } : {}),
    ...(strokeWidth !== undefined ? { strokeWidth } : {}),
    ...(el.props.vectorEffect === "none" || el.props.vectorEffect === "non-scaling-stroke"
      ? { vectorEffect: el.props.vectorEffect } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(el.type === "Fill" && el.props.gradient !== undefined ? { complex: true } : {}),
    ...((styleObject?.background !== undefined || styleObject?.backgroundColor !== undefined || typeof style === "string" && /(?:^|;)\s*background(?:-color)?\s*:/i.test(style)) ? { complex: true } : {}),
    ...((styleObject?.opacity !== undefined && objectOpacity === undefined || typeof style === "string" && /(?:^|;)\s*opacity\s*:/i.test(style) && styleOpacity === undefined) ? { complex: true } : {}),
  };
  return Object.keys(paint).length > 0 ? paint : undefined;
}

function referenceId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const match = value.match(/^url\(#(.+)\)$/);
  return (match?.[1] ?? value.replace(/^#/, "")) || undefined;
}

function relationsOf(el: MediaElement): TreeRelations | undefined {
  const mask = referenceId(el.props.mask);
  const clip = referenceId(el.props.clip);
  const filter = referenceId(el.props.filter);
  const references = [mask, clip, filter].filter((value): value is string => value !== undefined);
  if (references.length === 0) return undefined;
  return {
    ...(mask ? { mask } : {}),
    ...(clip ? { clip } : {}),
    ...(filter ? { filter } : {}),
    references,
  };
}

function pathGeometry(el: MediaElement): { geometry: TreeGeometry; bounds?: TreeBounds } | undefined {
  if (el.type !== "VectorPath" && el.type !== "path") return undefined;
  const d = typeof el.props.d === "string" ? el.props.d : "";
  if (!d.trim()) {
    return { geometry: { kind: "path", d, valid: false, error: "Path data is empty" } };
  }
  try {
    const bounds = pathBounds(d);
    return {
      geometry: { kind: "path", d, valid: true },
      bounds: { ...bounds, estimated: true },
    };
  } catch (error) {
    return {
      geometry: {
        kind: "path",
        d,
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function vectorShapeBounds(el: MediaElement): TreeBounds | undefined {
  if (el.type === "VectorCircle") {
    const cx = num(el.props.cx), cy = num(el.props.cy), r = num(el.props.r);
    if (cx !== undefined && cy !== undefined && r !== undefined && r >= 0) {
      return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
    }
  }
  if (el.type === "VectorRect") {
    const width = num(el.props.width), height = num(el.props.height);
    if (width !== undefined && height !== undefined) {
      return { x: num(el.props.x) ?? 0, y: num(el.props.y) ?? 0, width, height };
    }
  }
  return undefined;
}

function opaqueVectorBounds(el: MediaElement): TreeBounds | undefined {
  if (el.type !== "Html") return undefined;
  const x = num(el.props.x) ?? 0;
  const y = num(el.props.y) ?? 0;
  const width = num(el.props.width);
  const height = num(el.props.height);
  return width !== undefined && height !== undefined ? { x, y, width, height } : undefined;
}

interface CollectContext {
  namespace: TreeNamespace;
  matrix: Matrix;
  path: string;
  parentPath?: string;
  depth: number;
  canvasWidth: number;
  measurer?: TextMeasurer;
  vectorStyle?: VectorInheritedStyle;
  dx?: number;
  dy?: number;
  supported?: boolean;
  hidden?: boolean;
  clip?: MediaLayout;
  flow?: readonly { stack: string; item: string }[];
  layoutRole?: "root" | "flow" | "layer";
  transient?: boolean;
  parentConstraints?: { width: boolean; height: boolean };
}

function translated(box: MediaLayout, x: number, y: number): MediaLayout {
  return { ...box, x: box.x + x, y: box.y + y };
}
function intersection(a: MediaLayout, b: MediaLayout): MediaLayout {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}
function htmlTransform(el: MediaElement): { x: number; y: number; supported: boolean } {
  if (el.props.class !== undefined || el.props.className !== undefined) return { x: 0, y: 0, supported: false };
  const style = el.props.style;
  let raw: unknown;
  if (typeof style === "string") {
    if (/(?:^|;)\s*(?:clip-path|mask|filter|overflow-x|overflow-y)\s*:/i.test(style)) return { x: 0, y: 0, supported: false };
    raw = /(?:^|;)\s*transform\s*:\s*([^;]+)/i.exec(style)?.[1];
  }
  else if (style && typeof style === "object" && !Array.isArray(style)) {
    const s = style as Record<string, unknown>;
    if (s.clipPath !== undefined || s.mask !== undefined || s.filter !== undefined || s.overflowX !== undefined || s.overflowY !== undefined) return { x: 0, y: 0, supported: false };
    raw = s.transform;
  }
  else if (Array.isArray(style)) return { x: 0, y: 0, supported: false };
  const motion = el.props.motion;
  let x = 0, y = 0;
  if (motion && typeof motion === "object") {
    const m = motion as unknown as Record<string, unknown>;
    if ((num(m.scale) ?? 1) !== 1 || (num(m.rotate) ?? 0) !== 0 || (num(m.blur) ?? 0) !== 0 || (typeof m.style === "string" && (/(?:matrix|skew|perspective|filter\s*:)/i.test(m.style) || /transform\s*:/i.test(m.style) && (typeof m.x !== "number" || typeof m.y !== "number")))) return { x, y, supported: false };
    x += num(m.x) ?? 0; y += num(m.y) ?? 0;
  }
  if (raw === undefined || raw === "none") return { x, y, supported: el.props.transform === undefined };
  if (typeof raw !== "string") return { x, y, supported: false };
  const rest = raw.replace(/translate(?:X|Y)?\(\s*-?(?:\d+(?:\.\d+)?|\.\d+)px(?:\s*,\s*-?(?:\d+(?:\.\d+)?|\.\d+)px)?\s*\)/g, match => {
    const values = [...match.matchAll(/(-?(?:\d+(?:\.\d+)?|\.\d+))px/g)].map(m => Number(m[1]));
    if (match.startsWith("translateY")) y += values[0] ?? 0;
    else { x += values[0] ?? 0; y += values[1] ?? 0; }
    return "";
  }).replace(/scale\(1(?:\.0+)?\)|rotate\(0(?:\.0+)?deg\)/g, "").trim();
  return { x, y, supported: rest.length === 0 && el.props.transform === undefined };
}

function collect(
  el: MediaElement,
  out: TreeNodeSemantics[],
  context: CollectContext,
): TreeBounds | undefined {
  const namespace: TreeNamespace = el.type === "Vector" ? "svg" : context.namespace;
  const matrix = el.type === "Vector"
    ? vectorViewMatrix(el)
    : el.type === "VectorViewport"
      ? multiply(context.matrix, multiply(transformMatrix(el.props.transform), vectorViewMatrix(el)))
      : namespace === "svg"
      ? multiply(context.matrix, transformMatrix(el.props.transform))
      : context.matrix;
  const motionRaw = el.props.motion ?? el.props.style;
  const vectorStyle = namespace === "svg" ? inheritedVectorStyle(el, context.vectorStyle) : undefined;
  const vectorMetrics = vectorStyle ? vectorTextMetrics(el, vectorStyle, context.measurer) : undefined;
  const text = namespace === "svg" ? vectorTextContent(el) : childText(el);
  const direct = directText(el);
  const path = pathGeometry(el);
  const localBounds = path?.bounds ?? vectorShapeBounds(el) ?? vectorMetrics?.bounds ?? opaqueVectorBounds(el);
  const ownBounds = namespace === "svg" && localBounds
    ? mapBounds(localBounds, matrix)
    : el.layout
      ? { ...el.layout }
      : undefined;
  const paint = paintOf(el);
  if (vectorStyle && paint) {
    if (vectorStyle.fill !== undefined) paint.fill = vectorStyle.fill;
    if (vectorStyle.opacity !== undefined) paint.opacity = vectorStyle.opacity;
  }
  const relations = relationsOf(el);
  const color = vectorMetrics ? vectorStyle?.fill ?? "#000000" : colorOf(el);
  const typography = el.type === "Text" ? typographyForPaint(el, context.canvasWidth) : undefined;
  const transform = namespace === "html" ? htmlTransform(el) : { x: 0, y: 0, supported: false };
  const dx = (context.dx ?? 0) + transform.x, dy = (context.dy ?? 0) + transform.y;
  const supported = context.supported !== false && transform.supported;
  const motion = isMotionResult(el.props.motion) ? el.props.motion : undefined;
  const transient = context.transient === true || (el.props.motion !== undefined && motion?.phase !== "steady");
  const styleObject = el.props.style && typeof el.props.style === "object" && !Array.isArray(el.props.style) ? el.props.style as Record<string, unknown> : undefined;
  const styleString = typeof el.props.style === "string" ? el.props.style : "";
  const hidden = context.hidden === true || el.props.opacity === 0 || motion?.opacity === 0 || styleObject?.opacity === 0 || styleObject?.display === "none" || styleObject?.visibility === "hidden" || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0*)?)\s*(?:;|$)/i.test(styleString);
  const spatialBox = namespace === "html" && el.layout ? translated(el.layout, dx, dy) : undefined;
  const styleOverflow = typeof el.props.style === "string" ? /(?:^|;)\s*overflow\s*:\s*(hidden|clip)\b/i.exec(el.props.style)?.[1] : styleObject?.overflow;
  const overflow = el.props.overflow ?? styleOverflow;
  const geometrySupported = supported && (overflow === undefined || overflow === "visible" || overflow === "hidden" || overflow === "clip");
  const clip = (overflow === "hidden" || overflow === "clip") && spatialBox ? (context.clip ? intersection(context.clip, spatialBox) : spatialBox) : context.clip;
  const info = layoutInfo(el);
  const parentContent = info && translated(info.parentContent, context.dx ?? 0, context.dy ?? 0);
  const lines = typography && spatialBox ? (typography.lines ?? []).map((text, i) => {
    const width = typography.lineWidths?.[i] ?? spatialBox.width;
    const x = typography.textAlign === "center" ? spatialBox.x + (spatialBox.width - width) / 2 : typography.textAlign === "right" ? spatialBox.x + spatialBox.width - width : spatialBox.x;
    return { text, bounds: { x, y: spatialBox.y + i * typography.fontSize * typography.lineHeight, width, height: typography.fontSize * typography.lineHeight } };
  }) : undefined;
  const textContent = lines?.length ? mergeBounds(lines.map(line => line.bounds)) : spatialBox;
  const node: TreeNodeSemantics = {
    tag: el.type,
    childCount: visibleChildCount(el),
    path: context.path,
    depth: context.depth,
    namespace,
    ...(namespace === "html" ? { layoutRole: context.layoutRole ?? "root" } : {}),
    ...(context.parentPath !== undefined ? { parentPath: context.parentPath } : {}),
    ...(typeof el.props.id === "string" ? { id: el.props.id } : {}),
    ...(PRIMITIVE_TYPES.has(el.type) ? { role: el.type } : {}),
    ...(text ? { text } : {}),
    ...(direct ? { directText: direct } : {}),
    ...(el.layout ? { layout: el.layout } : {}),
    ...(ownBounds ? { bounds: ownBounds } : {}),
    ...(color ? { color } : {}),
    ...(paint ? { paint } : {}),
    ...(vectorMetrics ? { metricsExact: vectorMetrics.metricsExact, fontFamily: vectorMetrics.typography.fontFamily, typography: vectorMetrics.typography, paint: { ...paint, ...(vectorMetrics.complexRuns ? { complex: true } : {}), ...(vectorStyle?.stroke ? { stroke: vectorStyle.stroke } : {}), ...(vectorStyle?.strokeWidth !== undefined ? { strokeWidth: vectorStyle.strokeWidth } : {}), fill: color!, opacity: vectorStyle?.opacity ?? 1, ...(vectorStyle?.fillOpacity !== undefined ? { fillOpacity: vectorStyle.fillOpacity } : {}) } } : {}),
    ...(typography ? { metricsExact: typography.metricsExact ?? false, fontFamily: typography.fontFamily, typography: { fontSize: typography.fontSize, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight, metricsSource: typography.metricsExact ? "font" as const : "heuristic" as const } } : {}),
    ...(spatialBox ? { spatial: { bounds: spatialBox, supported: geometrySupported, hidden, ...(clip ? { clip } : {}) } } : {}),
    ...(lines && textContent && parentContent ? { textGeometry: { lines, content: textContent, parentContent, constraints: context.parentConstraints ?? { width: false, height: false }, metrics: typography?.metricsExact ? "font" as const : "heuristic" as const, flow: context.flow ?? [], supported: geometrySupported, clipped: clip !== undefined, transient } } : {}),
    ...(path ? { geometry: path.geometry } : {}),
    ...(relations ? { relations } : {}),
    ...(el.type === "Html" ? { opaque: true } : {}),
    ...(typography?.metricsExact === false
      ? { metricsExact: false as const, fontFamily: typography.fontFamily }
      : {}),
    ...(isMotionResult(motionRaw)
      ? {
          motion: {
            x: motionRaw.x,
            y: motionRaw.y,
            scale: motionRaw.scale,
            rotate: motionRaw.rotate,
            opacity: motionRaw.opacity,
            phase: motionRaw.phase,
          },
        }
      : {}),
  };
  out.push(node);

  const childBounds: (TreeBounds | undefined)[] = [];
  for (let index = 0; index < el.children.length; index++) {
    const child = el.children[index];
    if (!isMediaElement(child)) continue;
    childBounds.push(collect(child, out, {
      namespace: namespace === "svg" && el.type === "foreignObject" ? "html" : namespace,
      matrix,
      path: `${context.path}.${index}`,
      parentPath: context.path,
      depth: context.depth + 1,
      canvasWidth: context.canvasWidth,
      dx, dy, supported: geometrySupported, hidden, transient,
      ...(clip ? { clip } : {}),
      flow: el.type === "Stack" ? [...(context.flow ?? []), { stack: context.path, item: `${context.path}.${index}` }] : context.flow ?? [],
      layoutRole: el.type === "Stack" ? "flow" : "layer",
      parentConstraints: { width: num(el.props.width) !== undefined || el.props.width === "fill", height: num(el.props.height) !== undefined || el.props.height === "fill" },
      ...(context.measurer ? { measurer: context.measurer } : {}),
      ...(vectorStyle ? { vectorStyle } : {}),
    }));
  }

  if (!node.bounds && namespace === "svg") {
    const merged = mergeBounds(childBounds);
    if (merged) node.bounds = merged;
  }
  return node.bounds;
}

export function walkMediaTree(
  node: MediaNode,
  canvas?: LayoutOptions,
): TreeNodeSemantics[] {
  const laid = layoutTree(node, canvas);
  const width = canvas?.width ?? (isMediaElement(node) ? num(node.props.width) : undefined) ?? 1920;
  const out: TreeNodeSemantics[] = [];
  collect(laid, out, { namespace: "html", matrix: IDENTITY, path: "0", depth: 0, canvasWidth: width, ...(canvas?.measurer ? { measurer: canvas.measurer } : {}) });
  for (const packet of collectSceneSnapshots(laid)) {
    for (const instance of packet.instances) out.push({
      id: instance.id, tag: "Instance", role: "instance", childCount: packet.parts.filter(p => p.instanceId === instance.id).length,
      bounds: instance.bounds, path: instance.id, parentPath: packet.sceneId,
    });
  }
  return out;
}
