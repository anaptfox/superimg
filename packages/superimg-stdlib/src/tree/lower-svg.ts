//! Layout-aware media tree → real SVG. Browser-only nodes are omitted; `needsBrowser` reports them.

import { tokenize, type HighlightToken, type ThemeName } from "../code.js";
import type { TextMeasurer } from "../svg/measure.js";
import { isMediaElement } from "./h.js";
import { layoutTree } from "./layout.js";
import { clampReveal, lowerLaidOutVector, sliceStringLinesByReveal } from "./lower.js";
import type { MediaChild, MediaElement, MediaLayout, MediaNode } from "./node-types.js";
import { DEFAULT_TEXT_COLOR } from "./primitives.js";
import {
  fmt,
  isPlainColor,
  resolvePaint,
  type ResolvedPaint,
  type SvgMotion,
} from "./svg-paint.js";
import { typographyForPaint } from "./typography.js";

const CODE_FONT_SIZE = 14;
const CODE_LINE_HEIGHT = 1.45;
const CODE_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";

const GROUP_TYPES = new Set(["Frame", "Stack", "Safe", "Spacer"]);

export interface LowerSvgOptions {
  width?: number;
  height?: number;
  measurer?: TextMeasurer;
  /** Plain color only. Gradients and images stay on the browser path. */
  background?: string;
}

interface SvgState {
  defs: string[];
  seq: number;
  canvasWidth: number;
  measurer?: TextMeasurer;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function boxOf(el: MediaElement): MediaLayout {
  return el.layout ?? { x: 0, y: 0, width: 0, height: 0 };
}

function nextId(state: SvgState, prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq}`;
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

function motionTransform(motion: SvgMotion, box: MediaLayout): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const translate = `translate(${fmt(motion.x)} ${fmt(motion.y)})`;
  const rotate = `rotate(${fmt(motion.rotate)} ${fmt(cx)} ${fmt(cy)})`;
  if (Math.abs(motion.scale - 1) < 1e-4) return `${translate} ${rotate} scale(1)`;
  return `${translate} ${rotate} translate(${fmt(cx)} ${fmt(cy)}) scale(${fmt(motion.scale)}) translate(${fmt(-cx)} ${fmt(-cy)})`;
}

function opacityValue(paint: ResolvedPaint): number | undefined {
  if (paint.motion) return paint.motion.opacity;
  return paint.opacity;
}

function pushClip(state: SvgState, box: MediaLayout, radius: number | undefined): string {
  const id = nextId(state, "si-clip");
  const rounded = radius !== undefined && radius > 0
    ? ` rx="${fmt(radius)}" ry="${fmt(radius)}"`
    : "";
  state.defs.push(
    `<clipPath id="${id}"><rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}" height="${fmt(box.height)}"${rounded}/></clipPath>`,
  );
  return id;
}

function pushGradient(state: SvgState, paint: ResolvedPaint): string | undefined {
  const gradient = paint.gradient;
  if (!gradient) return undefined;
  const id = nextId(state, "si-grad");
  const stops = gradient.stops
    .map((stop) => `<stop offset="${stop.offset}" stop-color="${escapeAttr(stop.color)}"/>`)
    .join("");
  if (gradient.kind === "linear") {
    state.defs.push(
      `<linearGradient id="${id}" gradientUnits="objectBoundingBox" x1="${fmt(gradient.x1)}" y1="${fmt(gradient.y1)}" x2="${fmt(gradient.x2)}" y2="${fmt(gradient.y2)}">${stops}</linearGradient>`,
    );
  } else {
    state.defs.push(
      `<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="${fmt(gradient.cx)}" cy="${fmt(gradient.cy)}" r="${fmt(gradient.r)}">${stops}</radialGradient>`,
    );
  }
  return id;
}

function rectAttrs(box: MediaLayout, radius: number | undefined): string {
  const parts = [
    `x="${fmt(box.x)}"`,
    `y="${fmt(box.y)}"`,
    `width="${fmt(Math.max(0, box.width))}"`,
    `height="${fmt(Math.max(0, box.height))}"`,
  ];
  if (radius !== undefined && radius > 0) parts.push(`rx="${fmt(radius)}"`, `ry="${fmt(radius)}"`);
  return parts.join(" ");
}

function fillRect(box: MediaLayout, fill: string, radius: number | undefined): string {
  return `<rect ${rectAttrs(box, radius)} fill="${escapeAttr(fill)}"/>`;
}

function strokeRect(box: MediaLayout, border: { width: number; color: string }, radius: number | undefined): string {
  const inset = border.width / 2;
  const stroked: MediaLayout = {
    x: box.x + inset,
    y: box.y + inset,
    width: Math.max(0, box.width - border.width),
    height: Math.max(0, box.height - border.width),
  };
  const rx = radius !== undefined ? Math.max(0, radius - inset) : undefined;
  return `<rect ${rectAttrs(stroked, rx)} fill="none" stroke="${escapeAttr(border.color)}" stroke-width="${fmt(border.width)}"/>`;
}

function paintShapes(box: MediaLayout, paint: ResolvedPaint, state: SvgState): string {
  const parts: string[] = [];
  const gradientId = pushGradient(state, paint);
  const fill = gradientId ? `url(#${gradientId})` : paint.fill;
  if (fill) parts.push(fillRect(box, fill, paint.radius));
  if (paint.border) parts.push(strokeRect(box, paint.border, paint.radius));
  return parts.join("");
}

function presentation(el: MediaElement, paint: ResolvedPaint, state: SvgState, clip: boolean): string[] {
  const box = boxOf(el);
  const attrs: string[] = [];
  if (typeof el.props.id === "string" && el.props.id) attrs.push(`id="${escapeAttr(el.props.id)}"`);
  if (paint.motion) attrs.push(`transform="${motionTransform(paint.motion, box)}"`);
  const opacity = opacityValue(paint);
  if (opacity !== undefined && Math.abs(opacity - 1) > 1e-4) attrs.push(`opacity="${fmt(opacity)}"`);
  if (paint.blendMode !== undefined && paint.blendMode !== "normal") {
    attrs.push(`style="mix-blend-mode:${escapeAttr(paint.blendMode)}"`);
  }
  if (clip) attrs.push(`clip-path="url(#${pushClip(state, box, paint.radius)})"`);
  return attrs;
}

function wrap(tag: string, attrs: string[], inner: string): string {
  const open = attrs.length ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
  return `${open}${inner}</${tag}>`;
}

function elementChildren(el: MediaElement, state: SvgState): string {
  let out = "";
  for (const child of el.children) {
    if (isMediaElement(child)) out += serializeNode(child, state);
  }
  return out;
}

function imageAspect(fit: unknown): string {
  if (fit === "contain") return "xMidYMid meet";
  if (fit === "fill") return "none";
  return "xMidYMid slice";
}

function verticalMetrics(
  state: SvgState,
  family: string,
  size: number,
  weight: number,
  letterSpacing: number | undefined,
): { ascent: number; descent: number } {
  if (!state.measurer) return { ascent: size * 0.8, descent: size * 0.2 };
  const measured = state.measurer.measure("Mg", {
    fontFamily: family,
    fontSize: size,
    fontWeight: weight,
    ...(letterSpacing !== undefined ? { letterSpacing } : {}),
  });
  return { ascent: measured.ascent, descent: measured.descent };
}

/** CSS half-leading. Baseline of line i is `lineTop +` this, with `lineTop = i * lineBox`. */
function baselineOffset(lineBox: number, ascent: number, descent: number): number {
  return (lineBox - (ascent + descent)) / 2 + ascent;
}

function anchorOf(align: string, box: MediaLayout): { anchor: "start" | "middle" | "end"; x: number } {
  if (align === "center" || align === "middle") return { anchor: "middle", x: box.x + box.width / 2 };
  if (align === "right" || align === "end") return { anchor: "end", x: box.x + box.width };
  return { anchor: "start", x: box.x };
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

function tspanLines(
  lines: readonly (readonly HighlightToken[])[],
  x: number,
  firstDy: number,
  advance: number,
  foreground: string,
): string {
  return lines.map((line, index) => {
    const dy = index === 0 ? firstDy : advance;
    const inner = line.map((token) => {
      const fill = token.color && token.color !== foreground ? ` fill="${escapeAttr(token.color)}"` : "";
      return `<tspan${fill}>${escapeText(token.text)}</tspan>`;
    }).join("");
    return `<tspan x="${fmt(x)}" dy="${fmt(dy)}">${inner}</tspan>`;
  }).join("");
}

function plainLines(lines: readonly string[], x: number, firstDy: number, advance: number): string {
  return lines.map((line, index) => {
    const dy = index === 0 ? firstDy : advance;
    return `<tspan x="${fmt(x)}" dy="${fmt(dy)}">${escapeText(line)}</tspan>`;
  }).join("");
}

function sliceTokensByReveal(
  tokens: readonly HighlightToken[],
  totalChars: number,
  reveal: number,
): HighlightToken[] {
  let remaining = Math.round(reveal * totalChars);
  if (remaining <= 0) return [];
  if (remaining >= totalChars) return [...tokens];
  const out: HighlightToken[] = [];
  for (const token of tokens) {
    if (remaining <= 0) break;
    const chars = Array.from(token.text);
    const slice = chars.slice(0, remaining).join("");
    remaining -= Math.min(remaining, chars.length);
    if (slice.length > 0) {
      out.push({ text: slice, color: token.color });
    }
  }
  return out;
}

function serializeText(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const box = boxOf(el);
  const type = typographyForPaint(el, state.canvasWidth);
  const rawLines = type.lines && type.lines.length > 0 ? type.lines : [childText(el)];
  const reveal = clampReveal(el.props.reveal);
  const lines = reveal !== undefined && reveal < 1
    ? sliceStringLinesByReveal(rawLines, reveal)
    : rawLines;
  const family = type.fontFamily;
  const size = type.fontSize;
  const weight = type.fontWeight;
  const color = typeof el.props.color === "string" && isPlainColor(el.props.color)
    ? el.props.color
    : DEFAULT_TEXT_COLOR;
  const { anchor, x } = anchorOf(type.textAlign, box);
  const metrics = verticalMetrics(state, family, size, weight, type.letterSpacing);
  const lineBox = type.lineHeight * size;
  const baseline = baselineOffset(lineBox, metrics.ascent, metrics.descent);
  const attrs = [
    ...presentation(el, paint, state, paint.clip),
    `y="${fmt(box.y)}"`,
    `font-family="${escapeAttr(family)}"`,
    `font-size="${fmt(size)}"`,
    `font-weight="${fmt(weight)}"`,
    `fill="${escapeAttr(color)}"`,
    `text-anchor="${anchor}"`,
    `xml:space="preserve"`,
  ];
  if (type.letterSpacing !== undefined) attrs.push(`letter-spacing="${fmt(type.letterSpacing)}"`);
  const inner = plainLines(lines, x, baseline, lineBox);
  return `<text ${attrs.join(" ")}>${inner}</text>`;
}

function serializeImage(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const box = boxOf(el);
  const src = typeof el.props.src === "string" ? el.props.src : "";
  const radius = paint.radius !== undefined && paint.radius > 0 ? paint.radius : undefined;
  const clip = paint.clip || radius !== undefined;
  const image = `<image href="${escapeAttr(src)}" xlink:href="${escapeAttr(src)}" x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.width)}" height="${fmt(box.height)}" preserveAspectRatio="${imageAspect(el.props.fit)}"/>`;
  const attrs = presentation(el, paint, state, clip);
  if (attrs.length === 0) return image;
  return wrap("g", attrs, image);
}

function serializeCode(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const box = boxOf(el);
  const source = typeof el.props.code === "string" ? el.props.code : childText(el);
  const theme = (typeof el.props.theme === "string" ? el.props.theme : "dark-plus") as ThemeName;
  const colored = tokenize(source, theme);
  const reveal = clampReveal(el.props.reveal);
  const tokens = reveal !== undefined && reveal < 1
    ? sliceTokensByReveal(colored.tokens, Array.from(source).length, reveal)
    : colored.tokens;
  const pad = resolvePad(el.props.pad);
  const size = CODE_FONT_SIZE;
  const advance = CODE_LINE_HEIGHT * size;
  const metrics = verticalMetrics(state, CODE_FONT_FAMILY, size, 400, undefined);
  const baseline = baselineOffset(advance, metrics.ascent, metrics.descent);
  const x = box.x + pad.left;
  const y = box.y + pad.top;
  const lines = tokenLines(tokens);
  if (el.props.lineNumbers === true) {
    const width = String(lines.length).length;
    for (let i = 0; i < lines.length; i++) {
      const gutter = `${String(i + 1).padStart(width, " ")} `;
      lines[i]!.unshift({ text: gutter, color: colored.foreground });
    }
  }
  const text = `<text y="${fmt(y)}" font-family="${escapeAttr(CODE_FONT_FAMILY)}" font-size="${fmt(size)}" font-weight="400" fill="${escapeAttr(colored.foreground)}" xml:space="preserve">${tspanLines(lines, x, baseline, advance, colored.foreground)}</text>`;
  const bg = fillRect(box, colored.background, paint.radius);
  const inner = `${bg}${text}${paint.border ? strokeRect(box, paint.border, paint.radius) : ""}`;
  return wrap("g", presentation(el, paint, state, paint.clip), inner);
}

function serializeVector(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const { x: _x, y: _y, motion: _motion, overflow: _overflow, ...rest } = el.props;
  const style = paint.rawStyle || paint.unsupportedStyle.length > 0 ? rest.style : undefined;
  const markup = lowerLaidOutVector(
    { ...el, props: { ...rest, style } },
    state.canvasWidth,
  );
  const box = boxOf(el);
  const attrs = [`x="${fmt(box.x)}"`, `y="${fmt(box.y)}"`];
  if (paint.motion) attrs.push(`transform="${motionTransform(paint.motion, box)}"`);
  const opacity = opacityValue(paint);
  if (opacity !== undefined && Math.abs(opacity - 1) > 1e-4) attrs.push(`opacity="${fmt(opacity)}"`);
  if (paint.blendMode !== undefined && paint.blendMode !== "normal") {
    attrs.push(`style="mix-blend-mode:${escapeAttr(paint.blendMode)}"`);
  }
  if (paint.clip) attrs.push(`clip-path="url(#${pushClip(state, box, paint.radius)})"`);
  return markup.replace(/^<svg\b/, `<svg ${attrs.join(" ")}`);
}

function serializeGroup(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const inner = `${paintShapes(boxOf(el), paint, state)}${elementChildren(el, state)}`;
  return wrap("g", presentation(el, paint, state, paint.clip), inner);
}

function serializeFill(el: MediaElement, state: SvgState): string {
  const paint = resolvePaint(el);
  const shapes = paintShapes(boxOf(el), paint, state);
  const attrs = presentation(el, paint, state, paint.clip);
  if (attrs.length === 0) return shapes;
  return wrap("g", attrs, shapes);
}

function serializeNode(el: MediaElement, state: SvgState): string {
  if (el.type === "Html" || el.type === "Video" || el.type === "Plate") return "";
  if (el.type === "Text") return serializeText(el, state);
  if (el.type === "Image") return serializeImage(el, state);
  if (el.type === "Code") return serializeCode(el, state);
  if (el.type === "Vector") return serializeVector(el, state);
  if (el.type === "Fill") return serializeFill(el, state);
  if (GROUP_TYPES.has(el.type)) return serializeGroup(el, state);
  return wrap("g", presentation(el, resolvePaint(el), state, false), elementChildren(el, state));
}

/**
 * Lower a laid-out media tree to an SVG document.
 * Absolute boxes become `x`/`y` on painted elements. Motion is a transform about the box center.
 */
export function lowerSvg(node: MediaNode, options: LowerSvgOptions = {}): string {
  const width = finite(node.props.width) ?? options.width ?? finite(node.layout?.width) ?? 1920;
  const height = finite(node.props.height) ?? options.height ?? finite(node.layout?.height) ?? 1080;
  const laidOut = layoutTree(node, {
    width,
    height,
    ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
  });
  const state: SvgState = {
    defs: [],
    seq: 0,
    canvasWidth: width,
    ...(options.measurer !== undefined ? { measurer: options.measurer } : {}),
  };
  const body = serializeNode(laidOut, state);
  const background = typeof options.background === "string" && isPlainColor(options.background)
    ? `<rect x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" fill="${escapeAttr(options.background)}"/>`
    : "";
  const defs = state.defs.length ? `<defs>${state.defs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">${background}${defs}${body}</svg>`;
}
