//! Layout-aware media tree -> canonical cross-OS DisplayList v1 Frame IR.

import { colord } from "colord";
import { tokenize, type HighlightToken, type ThemeName } from "../code.js";
import type { SceneMatrix, SpatialSceneSnapshot } from "../scene-types.js";
import type { TextMeasurer } from "../svg/measure.js";
import { isMediaElement } from "./h.js";
import { layoutTree } from "./layout.js";
import { clampReveal, sliceStringLinesByReveal } from "./lower.js";
import type { MediaChild, MediaElement, MediaLayout, MediaNode } from "./node-types.js";
import { DEFAULT_TEXT_COLOR } from "./primitives.js";
import { IDENTITY_MATRIX, multiplySceneMatrices, resolveSceneTree } from "./scene.js";
import {
  hasPresentFilter,
  isPlainColor,
  motionHasBlur,
  resolvePaint,
  type ParsedGradient,
  type ResolvedPaint,
  type SvgMotion,
} from "./svg-paint.js";
import { typographyForPaint } from "./typography.js";
import { formatVectorPoints, type VectorPointsValue, type VectorTransform } from "./vector.js";

export const DISPLAY_LIST_KIND = "@foxworth/superimg/display-list" as const;
export const DISPLAY_LIST_SCHEMA_VERSION = 1 as const;

export interface DisplayMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayGradientStop {
  color: string;
  offset: number;
}

export type DisplayPaint =
  | { kind: "solid"; color: string }
  | {
      kind: "linearGradient";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stops: DisplayGradientStop[];
    }
  | {
      kind: "radialGradient";
      cx: number;
      cy: number;
      r: number;
      stops: DisplayGradientStop[];
    };

export interface DisplayStroke {
  color: string;
  width: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  dashArray?: number[];
  dashOffset?: number;
}

export type DisplayBlendMode = "normal" | "multiply" | "screen" | "overlay";

export interface DisplayClip {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface DisplayTextLine {
  text: string;
  x: number;
  y: number;
  baselineY: number;
  width: number;
}

export interface DisplayOpBase {
  id: string;
  bounds: DisplayRect;
  matrix?: DisplayMatrix;
  opacity: number;
  blendMode?: DisplayBlendMode;
  clips?: DisplayClip[];
}

export type DisplayOp =
  | (DisplayOpBase & {
      kind: "rect";
      fill?: DisplayPaint;
      stroke?: DisplayStroke;
      radius?: number;
    })
  | (DisplayOpBase & {
      kind: "ellipse";
      fill?: DisplayPaint;
      stroke?: DisplayStroke;
    })
  | (DisplayOpBase & {
      kind: "path";
      d: string;
      fill?: DisplayPaint;
      fillRule?: "nonzero" | "evenodd";
      stroke?: DisplayStroke;
    })
  | (DisplayOpBase & {
      kind: "image";
      asset: string;
      fit: "cover" | "contain" | "fill";
      pixelArt?: boolean;
      radius?: number;
    })
  | (DisplayOpBase & {
      kind: "text";
      lines: DisplayTextLine[];
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      fontStyle: "normal" | "italic";
      letterSpacing?: number;
      lineHeight: number;
      align: "left" | "center" | "right";
      color: string;
      metricsExact: boolean;
    });

export interface DisplayAnchor {
  entity: string;
  name: string;
  x: number;
  y: number;
}

export interface DisplayListIssue {
  nodeId?: string;
  code: string;
  message: string;
}

export interface DisplayListFrame {
  kind: typeof DISPLAY_LIST_KIND;
  schemaVersion: typeof DISPLAY_LIST_SCHEMA_VERSION;
  width: number;
  height: number;
  ops: DisplayOp[];
  anchors: DisplayAnchor[];
  issues: DisplayListIssue[];
}

export interface LowerDisplayListOptions {
  width?: number;
  height?: number;
  measurer?: TextMeasurer;
  /** Plain color only. Non-colors emit an issue. */
  background?: string;
  /** When true, throw immediately if any issue is recorded. */
  strict?: boolean;
}

const CODE_FONT_SIZE = 14;
const CODE_LINE_HEIGHT = 1.45;
const CODE_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";
const GROUP_TYPES = new Set(["Frame", "Stack", "Safe", "Spacer"]);

interface InheritedState {
  matrix: SceneMatrix;
  opacity: number;
  blendMode?: DisplayBlendMode;
  clips: readonly DisplayClip[];
  vectorPaint?: {
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
  };
}

interface VectorDefsMap {
  paints: Map<string, DisplayPaint>;
  clips: Map<string, DisplayClip>;
}

interface LowerState {
  canvasWidth: number;
  measurer?: TextMeasurer;
  ops: DisplayOp[];
  issues: DisplayListIssue[];
  usedIds: Set<string>;
  seq: number;
}

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function finite(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function isIdentityMatrix(m: SceneMatrix): boolean {
  return (
    Math.abs(m.a - 1) < 1e-6 &&
    Math.abs(m.b) < 1e-6 &&
    Math.abs(m.c) < 1e-6 &&
    Math.abs(m.d - 1) < 1e-6 &&
    Math.abs(m.e) < 1e-6 &&
    Math.abs(m.f) < 1e-6
  );
}

function cleanMatrix(m: SceneMatrix): DisplayMatrix | undefined {
  if (isIdentityMatrix(m)) return undefined;
  return {
    a: round4(m.a),
    b: round4(m.b),
    c: round4(m.c),
    d: round4(m.d),
    e: round4(m.e),
    f: round4(m.f),
  };
}

function cleanRect(r: DisplayRect): DisplayRect {
  return {
    x: round4(r.x),
    y: round4(r.y),
    width: round4(Math.max(0, r.width)),
    height: round4(Math.max(0, r.height)),
  };
}

function normalizeColor(raw: string, extraAlpha?: number): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return undefined;
  const parsed = colord(trimmed);
  if (!parsed.isValid()) return undefined;
  const rgba = parsed.toRgb();
  const alpha = extraAlpha !== undefined ? clamp01(rgba.a * extraAlpha) : clamp01(rgba.a);
  const r = Math.round(rgba.r).toString(16).padStart(2, "0");
  const g = Math.round(rgba.g).toString(16).padStart(2, "0");
  const b = Math.round(rgba.b).toString(16).padStart(2, "0");
  if (alpha >= 1 - 1 / 510) return `#${r}${g}${b}`;
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}${a}`;
}

function parsePercentOrNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (t.endsWith("%")) {
      const n = Number(t.slice(0, -1));
      if (Number.isFinite(n)) return n / 100;
    }
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function convertGradient(g: ParsedGradient): DisplayPaint | undefined {
  const stops: DisplayGradientStop[] = [];
  for (const s of g.stops) {
    const color = normalizeColor(s.color);
    if (!color) return undefined;
    const offset = clamp01(parsePercentOrNumber(s.offset, 0));
    stops.push({ color, offset: round4(offset) });
  }
  if (stops.length === 0) return undefined;
  if (g.kind === "linear") {
    return {
      kind: "linearGradient",
      x1: round4(g.x1),
      y1: round4(g.y1),
      x2: round4(g.x2),
      y2: round4(g.y2),
      stops,
    };
  }
  return {
    kind: "radialGradient",
    cx: round4(g.cx),
    cy: round4(g.cy),
    r: round4(g.r),
    stops,
  };
}

function motionToMatrix(motion: SvgMotion, box: MediaLayout): SceneMatrix {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let m: SceneMatrix = { a: 1, b: 0, c: 0, d: 1, e: motion.x, f: motion.y };
  if (Math.abs(motion.rotate) > 1e-6 || Math.abs(motion.scale - 1) > 1e-6) {
    const rad = (motion.rotate * Math.PI) / 180;
    const cos = Math.cos(rad) * motion.scale;
    const sin = Math.sin(rad) * motion.scale;
    const toCenter: SceneMatrix = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
    const rotScale: SceneMatrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
    const fromCenter: SceneMatrix = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
    m = multiplySceneMatrices(m, multiplySceneMatrices(toCenter, multiplySceneMatrices(rotScale, fromCenter)));
  }
  return m;
}

function parseSvgTransform(value: unknown): SceneMatrix {
  if (!value) return IDENTITY_MATRIX;
  if (typeof value === "object" && !Array.isArray(value)) {
    const t = value as VectorTransform;
    let m: SceneMatrix = IDENTITY_MATRIX;
    const x = finite(t.x) ?? 0;
    const y = finite(t.y) ?? 0;
    if (x !== 0 || y !== 0) m = multiplySceneMatrices(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
    const ox = finite(t.originX) ?? 0;
    const oy = finite(t.originY) ?? 0;
    const rotate = finite(t.rotate) ?? 0;
    const sx = finite(t.scaleX) ?? finite(t.scale) ?? 1;
    const sy = finite(t.scaleY) ?? finite(t.scale) ?? 1;
    if (rotate !== 0 || sx !== 1 || sy !== 1) {
      if (ox !== 0 || oy !== 0) m = multiplySceneMatrices(m, { a: 1, b: 0, c: 0, d: 1, e: ox, f: oy });
      if (rotate !== 0) {
        const rad = (rotate * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        m = multiplySceneMatrices(m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 });
      }
      if (sx !== 1 || sy !== 1) {
        m = multiplySceneMatrices(m, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
      }
      if (ox !== 0 || oy !== 0) m = multiplySceneMatrices(m, { a: 1, b: 0, c: 0, d: 1, e: -ox, f: -oy });
    }
    return m;
  }
  if (typeof value !== "string") return IDENTITY_MATRIX;
  let m: SceneMatrix = IDENTITY_MATRIX;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const fn = match[1]!.toLowerCase();
    const nums = match[2]!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    let next: SceneMatrix = IDENTITY_MATRIX;
    if (fn === "matrix" && nums.length === 6) {
      next = { a: nums[0]!, b: nums[1]!, c: nums[2]!, d: nums[3]!, e: nums[4]!, f: nums[5]! };
    } else if (fn === "translate" && nums.length >= 1) {
      next = { a: 1, b: 0, c: 0, d: 1, e: nums[0]!, f: nums[1] ?? 0 };
    } else if (fn === "scale" && nums.length >= 1) {
      next = { a: nums[0]!, b: 0, c: 0, d: nums[1] ?? nums[0]!, e: 0, f: 0 };
    } else if (fn === "rotate" && nums.length >= 1) {
      const rad = (nums[0]! * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (nums.length >= 3) {
        const cx = nums[1]!;
        const cy = nums[2]!;
        next = multiplySceneMatrices(
          { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy },
          multiplySceneMatrices(
            { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 },
            { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy },
          ),
        );
      } else {
        next = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      }
    } else if (fn === "skewx" && nums.length >= 1) {
      next = { a: 1, b: 0, c: Math.tan((nums[0]! * Math.PI) / 180), d: 1, e: 0, f: 0 };
    } else if (fn === "skewy" && nums.length >= 1) {
      next = { a: 1, b: Math.tan((nums[0]! * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 };
    }
    m = multiplySceneMatrices(m, next);
  }
  return m;
}

function allocId(state: LowerState, preferred: string | undefined, fallbackPrefix: string): string {
  const base = preferred && preferred.trim().length > 0 ? preferred.trim() : `${fallbackPrefix}-${++state.seq}`;
  if (!state.usedIds.has(base)) {
    state.usedIds.add(base);
    return base;
  }
  let n = 1;
  while (state.usedIds.has(`${base}#${n}`)) n += 1;
  const id = `${base}#${n}`;
  state.usedIds.add(id);
  return id;
}

function preferredNodeId(el: MediaElement): string | undefined {
  if (typeof el.props["data-si-part"] === "string" && el.props["data-si-part"]) {
    return el.props["data-si-part"];
  }
  if (typeof el.props.id === "string" && el.props.id) return el.props.id;
  return undefined;
}

function pushIssue(state: LowerState, el: MediaElement | undefined, code: string, message: string): void {
  const nodeId = el && typeof el.props.id === "string" && el.props.id ? el.props.id : undefined;
  state.issues.push({ ...(nodeId ? { nodeId } : {}), code, message });
}

function toDisplayBlendMode(mode: string | undefined): DisplayBlendMode | undefined {
  if (mode === "normal" || mode === "multiply" || mode === "screen" || mode === "overlay") {
    return mode;
  }
  return undefined;
}

function checkPaintIssues(el: MediaElement, paint: ResolvedPaint, state: LowerState): void {
  if (paint.rawStyle) pushIssue(state, el, "UNSUPPORTED_STYLE", `Raw CSS style string on ${el.type}`);
  for (const key of paint.unsupportedStyle) {
    pushIssue(state, el, `UNSUPPORTED_STYLE:${key}`, `Unsupported CSS style property "${key}" on ${el.type}`);
  }
  if (paint.opacityInvalid) pushIssue(state, el, "INVALID_OPACITY", `Invalid opacity on ${el.type}`);
  if (paint.blendModeInvalid || (paint.blendMode !== undefined && !toDisplayBlendMode(paint.blendMode))) {
    pushIssue(state, el, "UNSUPPORTED_BLEND_MODE", `Unsupported blendMode on ${el.type}`);
  }
  if (paint.gradientInvalid) pushIssue(state, el, "UNSUPPORTED_GRADIENT", `Unsupported gradient on ${el.type}`);
  if (paint.borderInvalid) pushIssue(state, el, "UNSUPPORTED_BORDER", `Unsupported border on ${el.type}`);
  if (paint.radiusInvalid) pushIssue(state, el, "UNSUPPORTED_RADIUS", `Unsupported radius on ${el.type}`);
  if (el.props.kenBurns != null && el.props.kenBurns !== false) {
    pushIssue(state, el, "UNSUPPORTED_KEN_BURNS", `kenBurns is browser-only on ${el.type}`);
  }
  if (motionHasBlur(paint.motion)) pushIssue(state, el, "UNSUPPORTED_BLUR", `Motion blur filter is browser-only on ${el.type}`);
  if (paint.motion && hasPresentFilter(paint.motion.filter)) {
    pushIssue(state, el, "UNSUPPORTED_FILTER", `CSS filter "${paint.motion.filter}" is browser-only on ${el.type}`);
  }
}

function boxOf(el: MediaElement): MediaLayout {
  return el.layout ?? { x: 0, y: 0, width: 0, height: 0 };
}

function childText(el: MediaElement): string {
  const parts: string[] = [];
  const walk = (child: MediaChild): void => {
    if (typeof child === "string" || typeof child === "number") parts.push(String(child));
    else if (Array.isArray(child)) child.forEach(walk);
    else if (isMediaElement(child)) child.children.forEach(walk);
  };
  el.children.forEach(walk);
  return parts.join("");
}

function resolvePad(pad: unknown): { top: number; right: number; bottom: number; left: number } {
  if (typeof pad === "number" && Number.isFinite(pad)) {
    return { top: pad, right: pad, bottom: pad, left: pad };
  }
  if (pad && typeof pad === "object") {
    const p = pad as Record<string, unknown>;
    const x = finite(p.x) ?? 0;
    const y = finite(p.y) ?? 0;
    return {
      top: finite(p.top) ?? y,
      right: finite(p.right) ?? x,
      bottom: finite(p.bottom) ?? y,
      left: finite(p.left) ?? x,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function verticalMetrics(
  state: LowerState,
  family: string,
  size: number,
  weight: number,
  fontStyle: "normal" | "italic",
  letterSpacing: number | undefined,
): { ascent: number; descent: number } {
  if (!state.measurer) return { ascent: size * 0.8, descent: size * 0.2 };
  const measured = state.measurer.measure("Mg", {
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
    fontStyle,
    ...(letterSpacing !== undefined ? { letterSpacing } : {}),
  });
  return { ascent: measured.ascent, descent: measured.descent };
}

function baselineOffset(lineBox: number, ascent: number, descent: number): number {
  return (lineBox - (ascent + descent)) / 2 + ascent;
}

function buildOpBase(
  id: string,
  bounds: DisplayRect,
  inherited: InheritedState,
  localBlendMode?: DisplayBlendMode,
): DisplayOpBase {
  const matrix = cleanMatrix(inherited.matrix);
  const blendMode = localBlendMode ?? inherited.blendMode;
  return {
    id,
    bounds: cleanRect(bounds),
    ...(matrix ? { matrix } : {}),
    opacity: round4(clamp01(inherited.opacity)),
    ...(blendMode && blendMode !== "normal" ? { blendMode } : {}),
    ...(inherited.clips.length > 0 ? { clips: [...inherited.clips] } : {}),
  };
}

function transformClipRect(clip: DisplayClip, matrix: SceneMatrix): DisplayClip {
  if (isIdentityMatrix(matrix)) {
    return {
      x: round4(clip.x),
      y: round4(clip.y),
      width: round4(Math.max(0, clip.width)),
      height: round4(Math.max(0, clip.height)),
      ...(clip.radius !== undefined && clip.radius > 0 ? { radius: round4(clip.radius) } : {}),
    };
  }
  const corners = [
    { x: clip.x, y: clip.y },
    { x: clip.x + clip.width, y: clip.y },
    { x: clip.x, y: clip.y + clip.height },
    { x: clip.x + clip.width, y: clip.y + clip.height },
  ].map((p) => ({
    x: matrix.a * p.x + matrix.c * p.y + matrix.e,
    y: matrix.b * p.x + matrix.d * p.y + matrix.f,
  }));
  const minX = Math.min(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxX = Math.max(...corners.map((p) => p.x));
  const maxY = Math.max(...corners.map((p) => p.y));
  const scaleAvg = (Math.hypot(matrix.a, matrix.b) + Math.hypot(matrix.c, matrix.d)) / 2;
  return {
    x: round4(minX),
    y: round4(minY),
    width: round4(Math.max(0, maxX - minX)),
    height: round4(Math.max(0, maxY - minY)),
    ...(clip.radius !== undefined && clip.radius > 0 ? { radius: round4(clip.radius * scaleAvg) } : {}),
  };
}

function deriveNodeState(el: MediaElement, paint: ResolvedPaint, inherited: InheritedState, pushClip: boolean): InheritedState {
  const box = boxOf(el);
  const localOpacity = paint.motion ? paint.motion.opacity : (paint.opacity ?? 1);
  const nextMatrix = paint.motion ? multiplySceneMatrices(inherited.matrix, motionToMatrix(paint.motion, box)) : inherited.matrix;
  const nextOpacity = clamp01(inherited.opacity * clamp01(localOpacity));
  const nextBlendMode = toDisplayBlendMode(paint.blendMode) ?? inherited.blendMode;
  const nextClips = pushClip
    ? [
        ...inherited.clips,
        transformClipRect(
          {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            ...(paint.radius !== undefined && paint.radius > 0 ? { radius: paint.radius } : {}),
          },
          nextMatrix,
        ),
      ]
    : inherited.clips;
  return {
    matrix: nextMatrix,
    opacity: nextOpacity,
    ...(nextBlendMode ? { blendMode: nextBlendMode } : {}),
    clips: nextClips,
  };
}

function emitBoxPaint(el: MediaElement, paint: ResolvedPaint, box: MediaLayout, nodeState: InheritedState, state: LowerState): void {
  if (nodeState.opacity <= 0) return;
  let fill: DisplayPaint | undefined;
  if (paint.gradient) {
    fill = convertGradient(paint.gradient);
  } else if (paint.fill) {
    const color = normalizeColor(paint.fill);
    if (color) fill = { kind: "solid", color };
  }
  let stroke: DisplayStroke | undefined;
  if (paint.border && paint.border.width > 0) {
    const color = normalizeColor(paint.border.color);
    if (color) stroke = { color, width: round4(paint.border.width) };
  }
  if (!fill && !stroke) return;
  const id = allocId(state, preferredNodeId(el), el.type.toLowerCase());
  state.ops.push({
    ...buildOpBase(id, box, nodeState, toDisplayBlendMode(paint.blendMode)),
    kind: "rect",
    ...(fill ? { fill } : {}),
    ...(stroke ? { stroke } : {}),
    ...(paint.radius !== undefined && paint.radius > 0 ? { radius: round4(paint.radius) } : {}),
  });
}

function emitText(el: MediaElement, state: LowerState, inherited: InheritedState): void {
  const paint = resolvePaint(el);
  checkPaintIssues(el, paint, state);
  const box = boxOf(el);
  const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
  if (nodeState.opacity <= 0) return;

  const type = typographyForPaint(el, state.canvasWidth);
  const rawLines = type.lines && type.lines.length > 0 ? type.lines : [childText(el)];
  const reveal = clampReveal(el.props.reveal);
  const linesText = reveal !== undefined && reveal < 1 ? sliceStringLinesByReveal(rawLines, reveal) : rawLines;
  const fontStyle: "normal" | "italic" = el.props.fontStyle === "italic" ? "italic" : "normal";
  const align: "left" | "center" | "right" =
    type.textAlign === "center" || type.textAlign === "middle"
      ? "center"
      : type.textAlign === "right" || type.textAlign === "end"
        ? "right"
        : "left";
  const color =
    normalizeColor(
      typeof el.props.color === "string" && isPlainColor(el.props.color) ? el.props.color : DEFAULT_TEXT_COLOR,
    ) ?? "#111827";
  const metrics = verticalMetrics(state, type.fontFamily, type.fontSize, type.fontWeight, fontStyle, type.letterSpacing);
  const lineBox = type.lineHeight * type.fontSize;
  const bOffset = baselineOffset(lineBox, metrics.ascent, metrics.descent);

  const lines: DisplayTextLine[] = linesText.map((text, index) => {
    const measuredWidth =
      type.lineWidths?.[index] !== undefined && text === rawLines[index]
        ? type.lineWidths[index]!
        : state.measurer
          ? state.measurer.measure(text, {
              fontFamily: type.fontFamily,
              fontSize: type.fontSize,
              fontWeight: type.fontWeight,
              fontStyle,
              ...(type.letterSpacing !== undefined ? { letterSpacing: type.letterSpacing } : {}),
            }).width
          : text.length * type.fontSize * 0.55;
    const x =
      align === "center"
        ? box.x + (box.width - measuredWidth) / 2
        : align === "right"
          ? box.x + (box.width - measuredWidth)
          : box.x;
    const y = box.y + index * lineBox;
    return {
      text,
      x: round4(x),
      y: round4(y),
      baselineY: round4(y + bOffset),
      width: round4(measuredWidth),
    };
  });

  const id = allocId(state, preferredNodeId(el), "text");
  state.ops.push({
    ...buildOpBase(id, box, nodeState, toDisplayBlendMode(paint.blendMode)),
    kind: "text",
    lines,
    fontFamily: type.fontFamily,
    fontSize: round4(type.fontSize),
    fontWeight: Math.round(type.fontWeight),
    fontStyle,
    ...(type.letterSpacing !== undefined ? { letterSpacing: round4(type.letterSpacing) } : {}),
    lineHeight: round4(type.lineHeight),
    align,
    color,
    metricsExact: type.metricsExact === true,
  });
}

function emitImage(el: MediaElement, state: LowerState, inherited: InheritedState): void {
  const paint = resolvePaint(el);
  checkPaintIssues(el, paint, state);
  const box = boxOf(el);
  const radius = paint.radius !== undefined && paint.radius > 0 ? paint.radius : undefined;
  const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
  if (nodeState.opacity <= 0) return;
  const src = typeof el.props.src === "string" ? el.props.src : typeof el.props.href === "string" ? el.props.href : "";
  if (!src) {
    pushIssue(state, el, "MISSING_IMAGE_SRC", "Image node is missing src");
    return;
  }
  const fit: "cover" | "contain" | "fill" =
    el.props.fit === "contain" || el.props.fit === "fill" ? el.props.fit : "cover";
  const pixelArt = el.props.pixelArt === true ? true : undefined;
  const id = allocId(state, preferredNodeId(el), "image");
  state.ops.push({
    ...buildOpBase(id, box, nodeState, toDisplayBlendMode(paint.blendMode)),
    kind: "image",
    asset: src,
    fit,
    ...(pixelArt !== undefined ? { pixelArt } : {}),
    ...(radius !== undefined ? { radius: round4(radius) } : {}),
  });
}

function tokenLines(tokens: readonly HighlightToken[]): HighlightToken[][] {
  const lines: HighlightToken[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ text: part, color: token.color });
    });
  }
  return lines;
}

function emitCode(el: MediaElement, state: LowerState, inherited: InheritedState): void {
  const paint = resolvePaint(el);
  checkPaintIssues(el, paint, state);
  const box = boxOf(el);
  const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
  if (nodeState.opacity <= 0) return;
  const source = typeof el.props.code === "string" ? el.props.code : childText(el);
  const theme = (typeof el.props.theme === "string" ? el.props.theme : "dark-plus") as ThemeName;
  const colored = tokenize(source, theme);
  const reveal = clampReveal(el.props.reveal);
  const bg = normalizeColor(colored.background) ?? "#1e1e1e";
  const fg = normalizeColor(colored.foreground) ?? "#d4d4d4";

  const bgId = allocId(state, preferredNodeId(el) ? `${preferredNodeId(el)}/bg` : undefined, "code-bg");
  let stroke: DisplayStroke | undefined;
  if (paint.border && paint.border.width > 0) {
    const color = normalizeColor(paint.border.color);
    if (color) stroke = { color, width: round4(paint.border.width) };
  }
  state.ops.push({
    ...buildOpBase(bgId, box, nodeState, toDisplayBlendMode(paint.blendMode)),
    kind: "rect",
    fill: { kind: "solid", color: bg },
    ...(stroke ? { stroke } : {}),
    ...(paint.radius !== undefined && paint.radius > 0 ? { radius: round4(paint.radius) } : {}),
  });

  const rawTextLines = tokenLines(colored.tokens).map((line, i) => {
    const body = line.map((t) => t.text).join("");
    if (el.props.lineNumbers === true) {
      const gutterWidth = String(source.split("\n").length).length;
      return `${String(i + 1).padStart(gutterWidth, " ")} ${body}`;
    }
    return body;
  });
  const linesText = reveal !== undefined && reveal < 1 ? sliceStringLinesByReveal(rawTextLines, reveal) : rawTextLines;
  const pad = resolvePad(el.props.pad);
  const advance = CODE_LINE_HEIGHT * CODE_FONT_SIZE;
  const metrics = verticalMetrics(state, CODE_FONT_FAMILY, CODE_FONT_SIZE, 400, "normal", undefined);
  const bOffset = baselineOffset(advance, metrics.ascent, metrics.descent);
  const x = box.x + pad.left;
  const y0 = box.y + pad.top;
  const lines: DisplayTextLine[] = linesText.map((text, i) => {
    const y = y0 + i * advance;
    return {
      text,
      x: round4(x),
      y: round4(y),
      baselineY: round4(y + bOffset),
      width: round4(text.length * CODE_FONT_SIZE * 0.6),
    };
  });
  const textId = allocId(state, preferredNodeId(el) ? `${preferredNodeId(el)}/text` : undefined, "code-text");
  state.ops.push({
    ...buildOpBase(textId, { x, y: y0, width: Math.max(0, box.width - pad.left - pad.right), height: Math.max(0, box.height - pad.top - pad.bottom) }, nodeState, toDisplayBlendMode(paint.blendMode)),
    kind: "text",
    lines,
    fontFamily: CODE_FONT_FAMILY,
    fontSize: CODE_FONT_SIZE,
    fontWeight: 400,
    fontStyle: "normal",
    lineHeight: CODE_LINE_HEIGHT,
    align: "left",
    color: fg,
    metricsExact: false,
  });
}

// --- Vector traversal & defs resolution ---

function parseUrlRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(/^url\(\s*#([^)]+)\s*\)$/i);
  if (match) return match[1]!.trim();
  if (trimmed.startsWith("#")) return undefined;
  return undefined;
}

function collectVectorDefs(el: MediaElement, defs: VectorDefsMap): void {
  for (const child of el.children) {
    if (!isMediaElement(child)) continue;
    if (child.type === "VectorDefs" || child.type === "defs") {
      for (const def of child.children) {
        if (!isMediaElement(def)) continue;
        const id = typeof def.props.id === "string" ? def.props.id : undefined;
        if (!id) continue;
        if (def.type === "VectorLinearGradient" || def.type === "linearGradient") {
          const stops = collectGradientStops(def);
          if (stops.length > 0) {
            defs.paints.set(id, {
              kind: "linearGradient",
              x1: round4(parsePercentOrNumber(def.props.x1, 0)),
              y1: round4(parsePercentOrNumber(def.props.y1, 0)),
              x2: round4(parsePercentOrNumber(def.props.x2, 1)),
              y2: round4(parsePercentOrNumber(def.props.y2, 0)),
              stops,
            });
          }
        } else if (def.type === "VectorRadialGradient" || def.type === "radialGradient") {
          const stops = collectGradientStops(def);
          if (stops.length > 0) {
            defs.paints.set(id, {
              kind: "radialGradient",
              cx: round4(parsePercentOrNumber(def.props.cx, 0.5)),
              cy: round4(parsePercentOrNumber(def.props.cy, 0.5)),
              r: round4(parsePercentOrNumber(def.props.r, 0.5)),
              stops,
            });
          }
        } else if (def.type === "VectorClip" || def.type === "clipPath") {
          const rect = def.children.find(
            (c): c is MediaElement => isMediaElement(c) && (c.type === "rect" || c.type === "VectorRect"),
          );
          if (rect) {
            const rx = finite(rect.props.rx) ?? finite(rect.props.ry);
            defs.clips.set(id, {
              x: round4(finite(rect.props.x) ?? 0),
              y: round4(finite(rect.props.y) ?? 0),
              width: round4(Math.max(0, finite(rect.props.width) ?? 0)),
              height: round4(Math.max(0, finite(rect.props.height) ?? 0)),
              ...(rx !== undefined && rx > 0 ? { radius: round4(rx) } : {}),
            });
          }
        }
      }
    } else {
      collectVectorDefs(child, defs);
    }
  }
}

function collectGradientStops(gradEl: MediaElement): DisplayGradientStop[] {
  const stops: DisplayGradientStop[] = [];
  for (const child of gradEl.children) {
    if (!isMediaElement(child)) continue;
    if (child.type !== "VectorStop" && child.type !== "stop") continue;
    const rawColor =
      typeof child.props.stopColor === "string"
        ? child.props.stopColor
        : typeof child.props["stop-color"] === "string"
          ? child.props["stop-color"]
          : undefined;
    if (!rawColor) continue;
    const stopOpacity = finite(child.props.stopOpacity) ?? finite(child.props["stop-opacity"]);
    const color = normalizeColor(rawColor, stopOpacity);
    if (!color) continue;
    const offset = clamp01(parsePercentOrNumber(child.props.offset, 0));
    stops.push({ color, offset: round4(offset) });
  }
  return stops;
}

function resolveVectorFill(
  el: MediaElement,
  inherited: InheritedState,
  defs: VectorDefsMap,
): DisplayPaint | undefined {
  const rawFill = el.props.fill !== undefined ? el.props.fill : inherited.vectorPaint?.fill;
  const fillOpacity =
    finite(el.props.fillOpacity) ?? finite(el.props["fill-opacity"]) ?? inherited.vectorPaint?.fillOpacity;
  if (rawFill === undefined) {
    // SVG default fill is black when neither fill nor stroke is specified, or when fill is omitted on shapes
    const color = normalizeColor("#000000", fillOpacity);
    return color ? { kind: "solid", color } : undefined;
  }
  if (typeof rawFill !== "string") return undefined;
  const trimmed = rawFill.trim();
  if (!trimmed || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "transparent") return undefined;
  const urlId = parseUrlRef(trimmed);
  if (urlId && defs.paints.has(urlId)) return defs.paints.get(urlId)!;
  if (defs.paints.has(trimmed)) return defs.paints.get(trimmed)!;
  const color = normalizeColor(trimmed, fillOpacity);
  return color ? { kind: "solid", color } : undefined;
}

function resolveVectorStroke(el: MediaElement, inherited: InheritedState): DisplayStroke | undefined {
  const rawStroke = el.props.stroke !== undefined ? el.props.stroke : inherited.vectorPaint?.stroke;
  if (typeof rawStroke !== "string") return undefined;
  const trimmed = rawStroke.trim();
  if (!trimmed || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "transparent") return undefined;
  const strokeOpacity =
    finite(el.props.strokeOpacity) ?? finite(el.props["stroke-opacity"]) ?? inherited.vectorPaint?.strokeOpacity;
  const color = normalizeColor(trimmed, strokeOpacity);
  if (!color) return undefined;
  const width =
    finite(el.props.strokeWidth) ??
    finite(el.props["stroke-width"]) ??
    inherited.vectorPaint?.strokeWidth ??
    1;
  if (width <= 0) return undefined;
  const cap = el.props.strokeLinecap ?? el.props["stroke-linecap"];
  const join = el.props.strokeLinejoin ?? el.props["stroke-linejoin"];
  const rawDash = el.props.strokeDasharray ?? el.props["stroke-dasharray"];
  let dashArray: number[] | undefined;
  if (typeof rawDash === "number" && Number.isFinite(rawDash) && rawDash > 0) {
    dashArray = [round4(rawDash)];
  } else if (typeof rawDash === "string" && rawDash.trim() && rawDash.trim() !== "none") {
    const parsed = rawDash
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0)
      .map(round4);
    if (parsed.length > 0) dashArray = parsed;
  }
  const dashOffset = finite(el.props.strokeDashoffset) ?? finite(el.props["stroke-dashoffset"]);
  return {
    color,
    width: round4(width),
    ...(cap === "butt" || cap === "round" || cap === "square" ? { lineCap: cap } : {}),
    ...(join === "miter" || join === "round" || join === "bevel" ? { lineJoin: join } : {}),
    ...(dashArray ? { dashArray } : {}),
    ...(dashOffset !== undefined ? { dashOffset: round4(dashOffset) } : {}),
  };
}

function parsePointsList(points: VectorPointsValue | unknown): Array<[number, number]> {
  if (!points) return [];
  const str = typeof points === "string" ? points : formatVectorPoints(points as VectorPointsValue);
  const nums = str
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push([nums[i]!, nums[i + 1]!]);
  }
  return out;
}

function pointsBounds(pts: readonly [number, number][]): DisplayRect {
  if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function viewBoxMatrix(box: MediaLayout, viewBox: { x: number; y: number; width: number; height: number }, fit: unknown): SceneMatrix {
  if (viewBox.width <= 0 || viewBox.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { a: 1, b: 0, c: 0, d: 1, e: box.x, f: box.y };
  }
  const sx = box.width / viewBox.width;
  const sy = box.height / viewBox.height;
  if (fit === "fill") {
    return {
      a: sx,
      b: 0,
      c: 0,
      d: sy,
      e: box.x - viewBox.x * sx,
      f: box.y - viewBox.y * sy,
    };
  }
  const scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  const tx = box.x + (box.width - viewBox.width * scale) / 2 - viewBox.x * scale;
  const ty = box.y + (box.height - viewBox.height * scale) / 2 - viewBox.y * scale;
  return { a: scale, b: 0, c: 0, d: scale, e: tx, f: ty };
}

function emitVectorNode(
  el: MediaElement,
  state: LowerState,
  inherited: InheritedState,
  defs: VectorDefsMap,
  fallbackId?: string,
): void {
  // Skip invisible nodes and Scene pointer-event hit targets
  if (el.props["data-si-hit"] === "1") return;
  if (typeof el.props.style === "string" && /display\s*:\s*none/i.test(el.props.style)) return;
  if (el.type === "VectorDefs" || el.type === "defs") return;

  if (el.type === "Html" || el.type === "Video" || el.type === "Plate") {
    pushIssue(state, el, "UNSUPPORTED_NODE", `${el.type} is browser-only`);
    return;
  }
  if (el.type === "foreignObject") {
    // resolveSceneTree() wraps non-SVG part content (such as Image) in a foreignObject with part bounds.
    if (fallbackId !== undefined) {
      const fx = finite(el.props.x) ?? 0;
      const fy = finite(el.props.y) ?? 0;
      const fw = finite(el.props.width) ?? 0;
      const fh = finite(el.props.height) ?? 0;
      const childEls = el.children.filter(isMediaElement);
      const unwrapped =
        childEls.length === 1 && childEls[0]!.type === "div"
          ? childEls[0]!.children.filter(isMediaElement)
          : childEls;
      if (unwrapped.length === 1 && unwrapped[0]!.type === "Image") {
        const img = unwrapped[0]!;
        const asset =
          typeof img.props.src === "string"
            ? img.props.src
            : typeof img.props.href === "string"
              ? img.props.href
              : "";
        if (asset) {
          const ix = finite(img.props.x) ?? 0;
          const iy = finite(img.props.y) ?? 0;
          const iw = img.props.width === "fill" ? fw : (finite(img.props.width) ?? fw);
          const ih = img.props.height === "fill" ? fh : (finite(img.props.height) ?? fh);
          const fit: "cover" | "contain" | "fill" =
            img.props.fit === "cover" || img.props.fit === "contain" || img.props.fit === "fill"
              ? img.props.fit
              : "fill";
          const imgOpacity = clamp01(inherited.opacity * clamp01(finite(img.props.opacity) ?? 1));
          if (imgOpacity > 0) {
            const id = allocId(state, preferredNodeId(img) ?? fallbackId, "image");
            state.ops.push({
              ...buildOpBase(id, { x: fx + ix, y: fy + iy, width: iw, height: ih }, { ...inherited, opacity: imgOpacity }),
              kind: "image",
              asset,
              fit,
              ...(img.props.pixelArt === true ? { pixelArt: true } : {}),
            });
          }
          return;
        }
      }
    }
    pushIssue(state, el, "UNSUPPORTED_NODE", `foreignObject is browser-only`);
    return;
  }

  const localOpacity = finite(el.props.opacity) ?? 1;
  const nextOpacity = clamp01(inherited.opacity * clamp01(localOpacity));
  if (nextOpacity <= 0) return;

  const localTransform = parseSvgTransform(el.props.transform);
  const nextMatrix = multiplySceneMatrices(inherited.matrix, localTransform);
  const rawClip =
    typeof el.props.clip === "string"
      ? el.props.clip
      : parseUrlRef(el.props["clip-path"]);
  const nextClips = [...inherited.clips];
  if (rawClip && defs.clips.has(rawClip)) {
    nextClips.push(transformClipRect(defs.clips.get(rawClip)!, nextMatrix));
  }
  const nextVectorPaint = {
    fill: typeof el.props.fill === "string" ? el.props.fill : inherited.vectorPaint?.fill,
    fillOpacity: finite(el.props.fillOpacity) ?? finite(el.props["fill-opacity"]) ?? inherited.vectorPaint?.fillOpacity,
    stroke: typeof el.props.stroke === "string" ? el.props.stroke : inherited.vectorPaint?.stroke,
    strokeWidth: finite(el.props.strokeWidth) ?? finite(el.props["stroke-width"]) ?? inherited.vectorPaint?.strokeWidth,
    strokeOpacity: finite(el.props.strokeOpacity) ?? finite(el.props["stroke-opacity"]) ?? inherited.vectorPaint?.strokeOpacity,
  };
  const nextBlendMode =
    el.props.blendMode === "normal" ||
    el.props.blendMode === "multiply" ||
    el.props.blendMode === "screen" ||
    el.props.blendMode === "overlay"
      ? el.props.blendMode
      : inherited.blendMode;
  const nodeState: InheritedState = {
    matrix: nextMatrix,
    opacity: nextOpacity,
    ...(nextBlendMode ? { blendMode: nextBlendMode } : {}),
    clips: nextClips,
    vectorPaint: nextVectorPaint,
  };
  const partId = preferredNodeId(el) ?? fallbackId;

  if (el.type === "VectorGroup" || el.type === "g") {
    const childFallback = typeof el.props["data-si-part"] === "string" ? el.props["data-si-part"] : fallbackId;
    for (const child of el.children) {
      if (isMediaElement(child)) emitVectorNode(child, state, nodeState, defs, childFallback);
    }
    return;
  }

  if (el.type === "VectorViewport" || el.type === "svg") {
    const x = finite(el.props.x) ?? 0;
    const y = finite(el.props.y) ?? 0;
    const w = finite(el.props.width) ?? 0;
    const h = finite(el.props.height) ?? 0;
    const vb = el.props.viewBox as { x?: number; y?: number; width?: number; height?: number } | undefined;
    const subMatrix =
      vb && typeof vb === "object"
        ? viewBoxMatrix({ x, y, width: w, height: h }, { x: vb.x ?? 0, y: vb.y ?? 0, width: vb.width ?? w, height: vb.height ?? h }, el.props.fit)
        : { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
    const subState: InheritedState = {
      ...nodeState,
      matrix: multiplySceneMatrices(nodeState.matrix, subMatrix),
    };
    for (const child of el.children) {
      if (isMediaElement(child)) emitVectorNode(child, state, subState, defs, partId);
    }
    return;
  }

  if (el.type === "VectorRect" || el.type === "rect") {
    const x = finite(el.props.x) ?? 0;
    const y = finite(el.props.y) ?? 0;
    const width = finite(el.props.width) ?? 0;
    const height = finite(el.props.height) ?? 0;
    const radius = finite(el.props.rx) ?? finite(el.props.ry);
    const fill = resolveVectorFill(el, inherited, defs);
    const stroke = resolveVectorStroke(el, inherited);
    if (!fill && !stroke) return;
    const id = allocId(state, partId, "rect");
    state.ops.push({
      ...buildOpBase(id, { x, y, width, height }, nodeState),
      kind: "rect",
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
      ...(radius !== undefined && radius > 0 ? { radius: round4(radius) } : {}),
    });
    return;
  }

  if (el.type === "VectorCircle" || el.type === "circle") {
    const cx = finite(el.props.cx) ?? 0;
    const cy = finite(el.props.cy) ?? 0;
    const r = finite(el.props.r) ?? 0;
    const fill = resolveVectorFill(el, inherited, defs);
    const stroke = resolveVectorStroke(el, inherited);
    if (!fill && !stroke) return;
    const id = allocId(state, partId, "ellipse");
    state.ops.push({
      ...buildOpBase(id, { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, nodeState),
      kind: "ellipse",
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    });
    return;
  }

  if (el.type === "VectorEllipse" || el.type === "ellipse") {
    const cx = finite(el.props.cx) ?? 0;
    const cy = finite(el.props.cy) ?? 0;
    const rx = finite(el.props.rx) ?? 0;
    const ry = finite(el.props.ry) ?? 0;
    const fill = resolveVectorFill(el, inherited, defs);
    const stroke = resolveVectorStroke(el, inherited);
    if (!fill && !stroke) return;
    const id = allocId(state, partId, "ellipse");
    state.ops.push({
      ...buildOpBase(id, { x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry }, nodeState),
      kind: "ellipse",
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    });
    return;
  }

  if (el.type === "VectorLine" || el.type === "line") {
    const x1 = finite(el.props.x1) ?? 0;
    const y1 = finite(el.props.y1) ?? 0;
    const x2 = finite(el.props.x2) ?? 0;
    const y2 = finite(el.props.y2) ?? 0;
    const stroke = resolveVectorStroke(el, inherited);
    if (!stroke) return;
    const bounds = pointsBounds([[x1, y1], [x2, y2]]);
    const id = allocId(state, partId, "line");
    state.ops.push({
      ...buildOpBase(id, bounds, nodeState),
      kind: "path",
      d: `M ${round4(x1)} ${round4(y1)} L ${round4(x2)} ${round4(y2)}`,
      stroke,
    });
    return;
  }

  if (el.type === "VectorPolyline" || el.type === "polyline" || el.type === "VectorPolygon" || el.type === "polygon") {
    const pts = parsePointsList(el.props.points);
    if (pts.length === 0) return;
    const closed = el.type === "VectorPolygon" || el.type === "polygon";
    const d =
      pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${round4(x)} ${round4(y)}`).join(" ") + (closed ? " Z" : "");
    const fill = resolveVectorFill(el, inherited, defs);
    const stroke = resolveVectorStroke(el, inherited);
    if (!fill && !stroke) return;
    const fillRule = el.props.fillRule === "evenodd" || el.props["fill-rule"] === "evenodd" ? "evenodd" : undefined;
    const id = allocId(state, partId, closed ? "polygon" : "polyline");
    state.ops.push({
      ...buildOpBase(id, pointsBounds(pts), nodeState),
      kind: "path",
      d,
      ...(fill ? { fill } : {}),
      ...(fillRule ? { fillRule } : {}),
      ...(stroke ? { stroke } : {}),
    });
    return;
  }

  if (el.type === "VectorPath" || el.type === "path") {
    const d = typeof el.props.d === "string" ? el.props.d.trim() : "";
    if (!d) return;
    const fill = resolveVectorFill(el, inherited, defs);
    const stroke = resolveVectorStroke(el, inherited);
    if (!fill && !stroke) return;
    const fillRule = el.props.fillRule === "evenodd" || el.props["fill-rule"] === "evenodd" ? "evenodd" : undefined;
    const bounds = el.layout ?? { x: 0, y: 0, width: state.canvasWidth, height: state.canvasWidth };
    const id = allocId(state, partId, "path");
    state.ops.push({
      ...buildOpBase(id, bounds, nodeState),
      kind: "path",
      d,
      ...(fill ? { fill } : {}),
      ...(fillRule ? { fillRule } : {}),
      ...(stroke ? { stroke } : {}),
    });
    return;
  }

  if (el.type === "image" || el.type === "Image") {
    const asset =
      typeof el.props.href === "string"
        ? el.props.href
        : typeof el.props.src === "string"
          ? el.props.src
          : "";
    if (!asset) return;
    const x = finite(el.props.x) ?? 0;
    const y = finite(el.props.y) ?? 0;
    const width = finite(el.props.width) ?? 0;
    const height = finite(el.props.height) ?? 0;
    const par = typeof el.props.preserveAspectRatio === "string" ? el.props.preserveAspectRatio : "";
    const fit: "cover" | "contain" | "fill" =
      el.props.fit === "cover" || el.props.fit === "contain" || el.props.fit === "fill"
        ? el.props.fit
        : par === "none"
          ? "fill"
          : par.includes("meet")
            ? "contain"
            : "cover";
    const pixelArt =
      el.props.pixelArt === true || el.props["image-rendering"] === "pixelated" ? true : undefined;
    const id = allocId(state, partId, "image");
    state.ops.push({
      ...buildOpBase(id, { x, y, width, height }, nodeState),
      kind: "image",
      asset,
      fit,
      ...(pixelArt !== undefined ? { pixelArt } : {}),
    });
    return;
  }

  if (el.type === "VectorText" || el.type === "text") {
    const text = childText(el);
    const x = finite(el.props.x) ?? 0;
    const baselineY = finite(el.props.y) ?? 0;
    const fontSize = finite(el.props.size) ?? finite(el.props["font-size"]) ?? 16;
    const fontWeight = finite(el.props.weight) ?? finite(el.props["font-weight"]) ?? 400;
    const fontFamily =
      typeof el.props.family === "string"
        ? el.props.family
        : typeof el.props["font-family"] === "string"
          ? el.props["font-family"]
          : "Inter, system-ui, sans-serif";
    const fontStyle: "normal" | "italic" =
      el.props.styleName === "italic" || el.props["font-style"] === "italic" ? "italic" : "normal";
    const anchor = el.props.anchor ?? el.props["text-anchor"];
    const align: "left" | "center" | "right" =
      anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";
    const fillColor =
      typeof el.props.fill === "string" ? normalizeColor(el.props.fill) : normalizeColor("#000000");
    const width = state.measurer
      ? state.measurer.measure(text, { fontFamily, fontSize, fontWeight, fontStyle }).width
      : text.length * fontSize * 0.55;
    const lineX = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    const topY = baselineY - fontSize * 0.8;
    const id = allocId(state, partId, "vtext");
    state.ops.push({
      ...buildOpBase(id, { x: lineX, y: topY, width, height: fontSize * 1.2 }, nodeState),
      kind: "text",
      lines: [{ text, x: round4(lineX), y: round4(topY), baselineY: round4(baselineY), width: round4(width) }],
      fontFamily,
      fontSize: round4(fontSize),
      fontWeight: Math.round(fontWeight),
      fontStyle,
      lineHeight: 1.2,
      align,
      color: fillColor ?? "#000000",
      metricsExact: Boolean(state.measurer),
    });
    return;
  }

  // Fallback for nested layout primitives inside a Vector wrapper
  for (const child of el.children) {
    if (isMediaElement(child)) emitVectorNode(child, state, nodeState, defs, partId);
  }
}

function emitVectorRoot(el: MediaElement, state: LowerState, inherited: InheritedState): void {
  const paint = resolvePaint(el);
  checkPaintIssues(el, paint, state);
  const box = boxOf(el);
  const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
  if (nodeState.opacity <= 0) return;

  const defs: VectorDefsMap = { paints: new Map(), clips: new Map() };
  collectVectorDefs(el, defs);

  const vb = el.props.viewBox as { x: number; y: number; width: number; height: number } | undefined;
  const vbMatrix =
    vb && typeof vb === "object"
      ? viewBoxMatrix(box, vb, el.props.fit)
      : { a: 1, b: 0, c: 0, d: 1, e: box.x, f: box.y };
  const vectorState: InheritedState = {
    ...nodeState,
    matrix: multiplySceneMatrices(nodeState.matrix, vbMatrix),
  };

  for (const child of el.children) {
    if (isMediaElement(child)) emitVectorNode(child, state, vectorState, defs);
  }
}

function emitNode(el: MediaElement, state: LowerState, inherited: InheritedState): void {
  if (el.type === "Html" || el.type === "Video" || el.type === "Plate" || el.type === "foreignObject") {
    pushIssue(state, el, "UNSUPPORTED_NODE", `${el.type} is browser-only and cannot be lowered to DisplayList`);
    return;
  }
  const className = [el.props.class, el.props.className].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (className.length > 0) {
    pushIssue(state, el, "UNSUPPORTED_CLASSNAME", `className "${className.join(" ")}" requires browser CSS`);
  }

  if (el.type === "Text") {
    emitText(el, state, inherited);
    return;
  }
  if (el.type === "Image") {
    emitImage(el, state, inherited);
    return;
  }
  if (el.type === "Code") {
    emitCode(el, state, inherited);
    return;
  }
  if (el.type === "Vector") {
    emitVectorRoot(el, state, inherited);
    return;
  }

  const paint = resolvePaint(el);
  checkPaintIssues(el, paint, state);
  const box = boxOf(el);
  const nodeState = deriveNodeState(el, paint, inherited, paint.clip);
  if (nodeState.opacity <= 0) return;

  if (el.type === "Fill" || GROUP_TYPES.has(el.type)) {
    emitBoxPaint(el, paint, box, nodeState, state);
  }

  for (const child of el.children) {
    if (isMediaElement(child)) emitNode(child, state, nodeState);
  }
}

function collectAnchors(snapshots: readonly SpatialSceneSnapshot[]): DisplayAnchor[] {
  const anchors: DisplayAnchor[] = [];
  const seen = new Set<string>();
  for (const snapshot of snapshots) {
    const visible = new Set(
      snapshot.nodes.filter((n) => n.visible && n.opacity > 0).map((n) => n.id),
    );
    for (const instance of snapshot.instances) {
      if (!visible.has(instance.id)) continue;
      const entity = instance.entityId ?? instance.id;
      for (const [name, point] of Object.entries(instance.anchors)) {
        const key = `${entity}\0${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        anchors.push({
          entity,
          name,
          x: round4(point.x),
          y: round4(point.y),
        });
      }
    }
  }
  return anchors;
}

/**
 * Lower a media tree (including spatial Scenes, layout primitives, text, images, and Vector trees)
 * to a canonical, JSON-serializable, cross-OS DisplayList v1 frame.
 */
export function lowerDisplayList(
  node: MediaNode,
  options: LowerDisplayListOptions = {},
): DisplayListFrame {
  const resolved = resolveSceneTree(node);
  const width = finite(resolved.props.width) ?? options.width ?? finite(resolved.layout?.width) ?? 1920;
  const height = finite(resolved.props.height) ?? options.height ?? finite(resolved.layout?.height) ?? 1080;

  const laidOut = layoutTree(resolved, {
    width,
    height,
    ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
  });

  const state: LowerState = {
    canvasWidth: width,
    ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
    ops: [],
    issues: [],
    usedIds: new Set(),
    seq: 0,
  };

  if (typeof options.background === "string" && options.background.trim()) {
    const bgColor = normalizeColor(options.background);
    if (bgColor) {
      state.ops.push({
        id: allocId(state, "__background", "bg"),
        kind: "rect",
        bounds: cleanRect({ x: 0, y: 0, width, height }),
        opacity: 1,
        fill: { kind: "solid", color: bgColor },
      });
    } else {
      state.issues.push({
        code: "UNSUPPORTED_BACKGROUND",
        message: `Background "${options.background}" is not a plain color`,
      });
    }
  }

  emitNode(laidOut, state, {
    matrix: IDENTITY_MATRIX,
    opacity: 1,
    clips: [],
  });

  const snapshots: SpatialSceneSnapshot[] = [];
  if (resolved.sceneSnapshot) snapshots.push(resolved.sceneSnapshot);
  if (resolved.sceneSnapshots) {
    for (const s of resolved.sceneSnapshots) {
      if (!snapshots.includes(s)) snapshots.push(s);
    }
  }

  const frame: DisplayListFrame = {
    kind: DISPLAY_LIST_KIND,
    schemaVersion: DISPLAY_LIST_SCHEMA_VERSION,
    width: round4(width),
    height: round4(height),
    ops: state.ops,
    anchors: collectAnchors(snapshots),
    issues: state.issues,
  };

  if (options.strict && frame.issues.length > 0) {
    const first = frame.issues[0]!;
    throw new TypeError(
      `DisplayList lowering failed (${first.code}${first.nodeId ? ` at ${first.nodeId}` : ""}): ${first.message}`,
    );
  }

  return frame;
}
