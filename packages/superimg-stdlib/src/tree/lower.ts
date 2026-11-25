//! Lower a media tree to an HTML or SVG markup string.

import type { MediaChild, MediaElement, MediaLayout, MediaNode } from "./node-types.js";
import { css } from "../css.js";
import { escapeHtml } from "../escape-html.js";
import { isMediaElement } from "./h.js";
import { layoutTree } from "./layout.js";
import { typographyForPaint } from "./typography.js";
import { formatVectorPoints, type VectorPointsValue } from "./vector.js";
import type { TextMeasurer } from "../svg/measure.js";

const HTML_VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

const PRIMITIVE_TAG: Record<string, string> = {
  Frame: "div",
  Stack: "div",
  Text: "p",
  Safe: "div",
  Code: "pre",
  Spacer: "div",
  Fill: "div",
  Image: "div",
  Video: "div",
  Plate: "div",
  Html: "div",
};

const VECTOR_TAG: Record<string, string> = {
  VectorCircle: "circle",
  VectorRect: "rect",
  VectorLine: "line",
  VectorEllipse: "ellipse",
  VectorPolyline: "polyline",
  VectorPolygon: "polygon",
  VectorViewport: "svg",
  VectorImage: "image",
  VectorLinearGradient: "linearGradient",
  VectorRadialGradient: "radialGradient",
  VectorStop: "stop",
  VectorPattern: "pattern",
  VectorFilter: "filter",
  VectorGaussianBlur: "feGaussianBlur",
  VectorMerge: "feMerge",
  VectorMergeNode: "feMergeNode",
  VectorTurbulence: "feTurbulence",
  VectorDisplacementMap: "feDisplacementMap",
  Vector: "svg",
  VectorGroup: "g",
  VectorPath: "path",
  VectorDefs: "defs",
  VectorMask: "mask",
  VectorClip: "clipPath",
  VectorText: "text",
  VectorRun: "tspan",
};

const SVG_ATTR: Record<string, string> = {
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  shapeRendering: "shape-rendering",
  imageRendering: "image-rendering",
  className: "class",
  fillOpacity: "fill-opacity",
  fillRule: "fill-rule",
  strokeWidth: "stroke-width",
  strokeOpacity: "stroke-opacity",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  vectorEffect: "vector-effect",
  pathLength: "pathLength",
  dominantBaseline: "dominant-baseline",
  letterSpacing: "letter-spacing",
};

const SKIP_ATTR = new Set([
  "key", "children", "style", "html", "motion", "className", "class",
  "semantic", "pad", "gap", "align", "justify", "direction", "variant", "size", "weight",
  "maxWidth", "preset", "radius", "border", "lang", "theme", "code", "lineNumbers",
  "x", "y", "width", "height", "fill", "overflow",
  "color", "fontFamily", "lineHeight", "letterSpacing", "wrap", "reveal",
  "gradient", "src", "fit", "kenBurns", "overlay", "poster", "muted", "loop",
  "playbackRate", "fps", "start", "at", "plateKind",
]);

const VECTOR_SKIP_ATTR = new Set([
  "key", "children", "style", "html", "motion", "className", "class",
  "semantic", "viewBox", "fit", "overflow", "mask", "clip", "filter", "transform",
  "mode", "family", "size", "weight", "anchor", "styleName", "preserveAspectRatio", "reveal",
]);

type MarkupNamespace = "html" | "svg";

export interface LowerOptions {
  medium?: "html" | "svg";
  width?: number;
  height?: number;
  /** Per-render measurer. Absent means the 0.55em heuristic. */
  measurer?: TextMeasurer;
  /** @internal Observe when actual emitted markup needs the browser purifier. */
  onPurificationRequired?: () => void;
  /** @internal Successful serialization handshake; no call when lowering throws. */
  onSerializationComplete?: (escaped: boolean) => void;
}

type PurificationObserver = (() => void) | undefined;
const ESCAPED_PRIMITIVES = new Set(["Frame", "Stack", "Text", "Fill"]);
const ESCAPED_ATTRIBUTES = new Set(["id", "class", "style", "title", "role", "tabindex", "tabIndex"]);
const idForms = new WeakMap<Document, HTMLFormElement>();

function escapedAttributeName(name: string): boolean {
  return typeof name === "string" && (ESCAPED_ATTRIBUTES.has(name) || /^(?:data|aria)-[a-zA-Z0-9_-]+$/.test(name));
}

function escapedId(value: string): boolean {
  if (typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9_:.-]*$/.test(value) || value in Object.prototype) return false;
  if (typeof document === "undefined") return true;
  let form = idForms.get(document);
  if (!form) {
    form = document.createElement("form");
    idForms.set(document, form);
  }
  return !(value in document) && !(value in form);
}

function isMotionResult(value: unknown): value is {
  style: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  phase: string;
  transform?: string;
  filter?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { style?: unknown }).style === "string" &&
    typeof (value as { opacity?: unknown }).opacity === "number" &&
    typeof (value as { phase?: unknown }).phase === "string"
  );
}

function serializeStyle(style: unknown): string {
  if (style == null || style === false) return "";
  if (typeof style === "string") return style;
  if (Array.isArray(style)) {
    return style.map(serializeStyle).filter(Boolean).join(";");
  }
  if (isMotionResult(style)) return style.style;
  if (typeof style === "object") {
    return css(style as Record<string, unknown>);
  }
  return "";
}

const COMPOSED_WITH_MOTION = new Set(["transform", "opacity", "filter"]);

/** Split `name:value` pairs on `;` and `:` that sit outside (), "", and ''. */
function splitDeclarations(style: string): Array<{ name: string; value: string; raw: string }> {
  const chunks: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | "\"" | null = null;
  for (let i = 0; i < style.length; i++) {
    const ch = style[i]!;
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (ch === ";" && depth === 0) {
      chunks.push(style.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(style.slice(start));

  const decls: Array<{ name: string; value: string; raw: string }> = [];
  for (const chunk of chunks) {
    const raw = chunk.trim();
    if (!raw) continue;
    let innerDepth = 0;
    let innerQuote: "'" | "\"" | null = null;
    let colon = -1;
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]!;
      if (innerQuote) {
        if (ch === "\\") {
          i += 1;
          continue;
        }
        if (ch === innerQuote) innerQuote = null;
        continue;
      }
      if (ch === "'" || ch === "\"") {
        innerQuote = ch;
        continue;
      }
      if (ch === "(") {
        innerDepth += 1;
        continue;
      }
      if (ch === ")") {
        if (innerDepth > 0) innerDepth -= 1;
        continue;
      }
      if (ch === ":" && innerDepth === 0) {
        colon = i;
        break;
      }
    }
    if (colon < 0) {
      decls.push({ name: "", value: "", raw });
      continue;
    }
    decls.push({
      name: chunk.slice(0, colon).trim(),
      value: chunk.slice(colon + 1).trim(),
      raw,
    });
  }
  return decls;
}

function parseOpacity(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function cssIdent(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function presentFilter(value: string): boolean {
  return value.length > 0 && value.toLowerCase() !== "none";
}

/**
 * Keep today's `authored;motion.style` string when style does not set
 * transform, opacity, or filter. Otherwise emit one composed declaration each.
 */
function composeWithMotion(
  authored: string,
  motion: { style: string; opacity: number; transform?: string; filter?: string },
): string {
  const decls = splitDeclarations(authored);
  const conflicts = decls.filter((decl) => COMPOSED_WITH_MOTION.has(decl.name.toLowerCase()));
  if (conflicts.length === 0) {
    return [authored, motion.style].filter(Boolean).join(";");
  }
  const last = (name: string): string | undefined => {
    const found = conflicts.filter((decl) => decl.name.toLowerCase() === name);
    return found.length ? found[found.length - 1]!.value : undefined;
  };
  const parts = decls
    .filter((decl) => !COMPOSED_WITH_MOTION.has(decl.name.toLowerCase()))
    .map((decl) => decl.raw);

  const authoredOpacity = last("opacity");
  const parsedOpacity = authoredOpacity === undefined ? undefined : parseOpacity(authoredOpacity);
  const opacity = authoredOpacity !== undefined && parsedOpacity !== undefined
    ? motion.opacity * parsedOpacity
    : motion.opacity;
  parts.push(`opacity:${opacity}`);

  const transform = [cssIdent(motion.transform), cssIdent(last("transform"))].filter(Boolean).join(" ");
  if (transform) parts.push(`transform:${transform}`);

  const filter = [cssIdent(motion.filter), cssIdent(last("filter"))].filter(presentFilter).join(" ");
  if (filter) parts.push(`filter:${filter}`);
  return parts.join(";");
}

export function clampReveal(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

export function sliceStringLinesByReveal(lines: readonly string[], reveal: number): string[] {
  const total = lines.reduce((sum, line) => sum + Array.from(String(line)).length, 0);
  let remaining = Math.round(reveal * total);
  if (remaining <= 0) return [];
  if (remaining >= total) return [...lines];
  const out: string[] = [];
  for (const line of lines) {
    if (remaining <= 0) break;
    const chars = Array.from(String(line));
    const slice = chars.slice(0, remaining).join("");
    remaining -= Math.min(remaining, chars.length);
    out.push(slice);
  }
  return out;
}

function countChildrenRevealChars(children: readonly MediaChild[]): number {
  let total = 0;
  for (const child of children) {
    if (typeof child === "string" || typeof child === "number") {
      total += Array.from(String(child)).length;
    } else if (Array.isArray(child)) {
      total += countChildrenRevealChars(child);
    } else if (isMediaElement(child)) {
      total += countChildrenRevealChars(child.children);
    }
  }
  return total;
}

function sliceChildrenByRevealBudget(
  children: readonly MediaChild[],
  state: { remaining: number },
): MediaChild[] {
  const out: MediaChild[] = [];
  for (const child of children) {
    if (typeof child === "string" || typeof child === "number") {
      if (state.remaining <= 0) continue;
      const chars = Array.from(String(child));
      const slice = chars.slice(0, state.remaining).join("");
      state.remaining -= Math.min(state.remaining, chars.length);
      if (slice.length > 0) out.push(slice);
    } else if (Array.isArray(child)) {
      const sliced = sliceChildrenByRevealBudget(child, state);
      if (sliced.length > 0) out.push(sliced);
    } else if (isMediaElement(child)) {
      if (state.remaining <= 0) continue;
      const sliced = sliceChildrenByRevealBudget(child.children, state);
      if (sliced.length > 0) {
        out.push({ ...child, children: sliced });
      }
    }
  }
  return out;
}

function revealChildren(el: MediaElement): readonly MediaChild[] {
  if (el.type !== "Text" && el.type !== "VectorText") return el.children;
  const reveal = clampReveal(el.props.reveal);
  if (reveal === undefined || reveal >= 1) return el.children;
  const total = countChildrenRevealChars(el.children);
  const budget = Math.round(reveal * total);
  if (budget <= 0) return [];
  if (budget >= total) return el.children;
  return sliceChildrenByRevealBudget(el.children, { remaining: budget });
}

function sliceHighlightedCodeHtml(html: string, source: string | undefined, reveal: number): string {
  const wrapper = /^(\s*<pre[^>]*><code[^>]*>)([\s\S]*)(<\/code><\/pre>\s*)$/.exec(html);
  if (!wrapper) return html;
  const [, open, body, close] = wrapper;
  const totalChars = typeof source === "string"
    ? Array.from(source).length
    : Array.from(
        body!
          .replace(/<span class="line-number"[^>]*>[\s\S]*?<\/span>/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&(?:#\d+|#x[0-9a-fA-F]+|\w+);/g, "_"),
      ).length;
  const budget = Math.round(reveal * totalChars);
  if (budget <= 0) return `${open}${close}`;
  if (budget >= totalChars) return html;

  let remaining = budget;
  let out = "";
  const openSpans: string[] = [];
  const pendingSpans: string[] = [];
  const tokenRe = /(<span class="line-number"[^>]*>[\s\S]*?<\/span>)|(<\/span>)|(<span[^>]*>)|(&(?:#\d+|#x[0-9a-fA-F]+|\w+);)|([\s\S])/gu;
  for (const match of body!.matchAll(tokenRe)) {
    const [full, lineNumberSpan, closeSpan, openSpan] = match;
    if (lineNumberSpan) {
      if (remaining > 0) {
        while (pendingSpans.length > 0) {
          const span = pendingSpans.shift()!;
          out += span;
          openSpans.push(span);
        }
        out += lineNumberSpan;
      }
      continue;
    }
    if (openSpan) {
      if (remaining > 0) pendingSpans.push(openSpan);
      continue;
    }
    if (closeSpan) {
      if (pendingSpans.length > 0) {
        pendingSpans.pop();
      } else if (openSpans.length > 0) {
        openSpans.pop();
        out += "</span>";
      }
      continue;
    }
    if (remaining <= 0) break;
    while (pendingSpans.length > 0) {
      const span = pendingSpans.shift()!;
      out += span;
      openSpans.push(span);
    }
    out += full;
    remaining -= 1;
    if (remaining <= 0) break;
  }
  while (openSpans.length > 0) {
    openSpans.pop();
    out += "</span>";
  }
  return `${open}${out}${close}`;
}

function textPaintStyle(el: MediaElement, canvasWidth: number): string {
  if (el.type !== "Text") return "";
  const { lines: _lines, metricsExact: _exact, ...paint } = typographyForPaint(el, canvasWidth);
  return css({
    margin: 0,
    padding: 0,
    ...paint,
    overflow: "visible",
  });
}

function laidOutTextHtml(el: MediaElement, canvasWidth: number, requirePurification: PurificationObserver): string | undefined {
  if (el.type !== "Text") return undefined;
  const rawLines = typographyForPaint(el, canvasWidth).lines;
  if (!rawLines || rawLines.length <= 1) return undefined;
  const reveal = clampReveal(el.props.reveal);
  const lines = reveal !== undefined && reveal < 1
    ? sliceStringLinesByReveal(rawLines, reveal)
    : rawLines;
  let html = "";
  for (let index = 0; index < lines.length; index++) {
    if (index > 0) html += "<br>";
    if (!(index in lines)) continue;
    const line = lines[index]!;
    if (requirePurification && typeof line !== "string") requirePurification();
    html += escapeHtml(line);
  }
  return html;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function layoutStyle(layout: MediaLayout | undefined, parent?: MediaLayout): string {
  if (!layout) return "";
  return css({
    position: "absolute",
    left: parent ? layout.x - parent.x : layout.x,
    top: parent ? layout.y - parent.y : layout.y,
    width: layout.width,
    height: layout.height,
    boxSizing: "border-box",
  });
}

function escapeAttr(value: string, requirePurification?: PurificationObserver): string {
  // A late accessor can return a value different from a preceding type guard.
  // Only the actual primitive string passed to our escaper is certified.
  if (requirePurification && typeof value !== "string") requirePurification();
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function textTag(el: MediaElement): string {
  const variant = el.props.variant;
  if (variant === "display" || variant === "title") return "h1";
  if (variant === "caption" || variant === "label") return "span";
  return "p";
}

function tagName(el: MediaElement, namespace: MarkupNamespace, requirePurification: PurificationObserver): string {
  if (namespace !== "html") requirePurification?.();
  if (el.type === "Text") return textTag(el);
  if (namespace === "svg" && el.type === "Html") return "g";
  const vector = VECTOR_TAG[el.type];
  if (vector) {
    requirePurification?.();
    return vector;
  }
  const primitiveType = el.type;
  const primitive = PRIMITIVE_TAG[primitiveType];
  if (primitive) {
    if (requirePurification && !ESCAPED_PRIMITIVES.has(primitiveType)) requirePurification();
    return primitive;
  }
  if (namespace === "svg" && el.type === "div") return "g";
  // Capture the tag that will actually be emitted. Style/accessor evaluation
  // below may mutate el.type, so checking its later value cannot certify it.
  const tag = el.type;
  if (requirePurification && tag !== "div") requirePurification();
  return tag;
}

function vectorTransform(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const t = value as Record<string, unknown>;
  const x = num(t.x) ?? 0;
  const y = num(t.y) ?? 0;
  const scale = num(t.scale);
  const scaleX = num(t.scaleX) ?? scale ?? 1;
  const scaleY = num(t.scaleY) ?? scale ?? 1;
  const rotate = num(t.rotate) ?? 0;
  const originX = num(t.originX) ?? 0;
  const originY = num(t.originY) ?? 0;
  const parts: string[] = [];
  if (x !== 0 || y !== 0) parts.push(`translate(${x} ${y})`);
  if (rotate !== 0) {
    parts.push(
      originX !== 0 || originY !== 0
        ? `rotate(${rotate} ${originX} ${originY})`
        : `rotate(${rotate})`,
    );
  }
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX} ${scaleY})`);
  return parts.join(" ") || undefined;
}

function definitionRef(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (value.startsWith("url(")) return value;
  return `url(#${value.replace(/^#/, "")})`;
}

const PAINT_DEF_TYPES = new Set([
  "VectorLinearGradient",
  "VectorRadialGradient",
  "VectorPattern",
  "VectorFilter",
  "VectorMask",
  "VectorClip",
]);

/** Ids of paint servers declared in this vector, not in a nested vector. */
function paintDefinitionIds(root: MediaElement): ReadonlySet<string> {
  const ids = new Set<string>();
  const visit = (child: MediaChild): void => {
    if (child == null || child === false || child === true) return;
    if (typeof child === "string" || typeof child === "number") return;
    if (Array.isArray(child)) {
      for (const item of child) visit(item);
      return;
    }
    if (!isMediaElement(child) || child.type === "Vector") return;
    if (PAINT_DEF_TYPES.has(child.type) && typeof child.props.id === "string" && child.props.id.length > 0) {
      ids.add(child.props.id.replace(/^#/, ""));
    }
    for (const nested of child.children) visit(nested);
  };
  for (const child of root.children) visit(child);
  return ids;
}

/** Bare fill/stroke that names a def in this vector. Colors and url() stay put. */
function paintDefinitionRef(value: string, defs: ReadonlySet<string> | undefined): string | undefined {
  if (defs === undefined || defs.size === 0 || value.startsWith("url(")) return undefined;
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return undefined;
  if (/^(?:rgb|hsl)a?\(/i.test(value)) return undefined;
  const id = value.replace(/^#/, "");
  return defs.has(id) ? `url(#${id})` : undefined;
}

function viewBoxValue(el: MediaElement): string {
  const viewBox = el.props.viewBox;
  if (viewBox && typeof viewBox === "object" && !Array.isArray(viewBox)) {
    const box = viewBox as Record<string, unknown>;
    const values = [num(box.x), num(box.y), num(box.width), num(box.height)];
    if (values.every((value) => value !== undefined)) return values.join(" ");
  }
  const width = el.layout?.width ?? num(el.props.width) ?? 1920;
  const height = el.layout?.height ?? num(el.props.height) ?? 1080;
  return `0 0 ${width} ${height}`;
}

function preserveAspectRatio(fit: unknown): string {
  if (fit === "cover") return "xMidYMid slice";
  if (fit === "fill") return "none";
  return "xMidYMid meet";
}

function collectClass(props: MediaElement["props"]): string | undefined {
  const parts = [props.class, props.className].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.length ? parts.join(" ") : undefined;
}

function serializeAttrs(
  el: MediaElement,
  namespace: MarkupNamespace,
  parentLayout: MediaLayout | undefined,
  canvasWidth: number,
  isRoot: boolean,
  requirePurification: PurificationObserver,
  paintDefs: ReadonlySet<string> | undefined,
): string {
  const parts: string[] = [];
  const cls = collectClass(el.props);
  if (cls) parts.push(`class="${escapeAttr(cls, requirePurification)}"`);
  if (typeof el.props.id === "string" && el.props.id) {
    const id = el.props.id;
    const serializedId = escapeAttr(id, requirePurification);
    if (requirePurification && !escapedId(serializedId)) requirePurification();
    parts.push(`id="${serializedId}"`);
  }
  if (PRIMITIVE_TAG[el.type] || VECTOR_TAG[el.type]) {
    parts.push(`data-si-primitive="${escapeAttr(el.type, requirePurification)}"`);
  }

  if (el.type === "Vector") {
    requirePurification?.();
    parts.push('xmlns="http://www.w3.org/2000/svg"');
    parts.push(`viewBox="${escapeAttr(viewBoxValue(el))}"`);
    parts.push(`preserveAspectRatio="${escapeAttr(typeof el.props.preserveAspectRatio === "string" ? el.props.preserveAspectRatio : preserveAspectRatio(el.props.fit))}"`);
    if (el.layout) {
      parts.push(`width="${el.layout.width}"`);
      parts.push(`height="${el.layout.height}"`);
    }
  }
  if (el.type === "VectorViewport") {
    parts.push(`viewBox="${escapeAttr(viewBoxValue(el))}"`);
    parts.push(`preserveAspectRatio="${escapeAttr(typeof el.props.preserveAspectRatio === "string" ? el.props.preserveAspectRatio : preserveAspectRatio(el.props.fit))}"`);
  }
  if (el.type === "VectorImage") {
    if (typeof el.props.preserveAspectRatio === "string") {
      parts.push(`preserveAspectRatio="${escapeAttr(el.props.preserveAspectRatio)}"`);
    } else if (el.props.fit !== undefined) {
      parts.push(`preserveAspectRatio="${escapeAttr(preserveAspectRatio(el.props.fit))}"`);
    }
  }
  const transform = vectorTransform(el.props.transform);
  if (transform) { requirePurification?.(); parts.push(`transform="${escapeAttr(transform)}"`); }
  const rawSvg = namespace === "svg" && !VECTOR_TAG[el.type] && el.type !== "Vector";
  const mask = rawSvg && typeof el.props.mask === "string" ? el.props.mask : definitionRef(el.props.mask);
  if (mask) { requirePurification?.(); parts.push(`mask="${escapeAttr(mask)}"`); }
  const clip = rawSvg && typeof el.props.clip === "string" ? el.props.clip : definitionRef(el.props.clip);
  if (clip) { requirePurification?.(); parts.push(`${rawSvg ? "clip" : "clip-path"}="${escapeAttr(clip)}"`); }
  const filter = rawSvg && typeof el.props.filter === "string" ? el.props.filter : definitionRef(el.props.filter);
  if (filter) { requirePurification?.(); parts.push(`filter="${escapeAttr(filter)}"`); }
  if (el.type === "VectorMask" && typeof el.props.mode === "string") {
    requirePurification?.();
    parts.push(`mask-type="${escapeAttr(el.props.mode)}"`);
  }
  if (el.type === "VectorText" || el.type === "VectorRun") {
    requirePurification?.();
    if (typeof el.props.family === "string") parts.push(`font-family="${escapeAttr(el.props.family)}"`);
    if (typeof el.props.size === "number") parts.push(`font-size="${el.props.size}"`);
    if (typeof el.props.weight === "number" || typeof el.props.weight === "string") {
      parts.push(`font-weight="${escapeAttr(String(el.props.weight))}"`);
    }
    if (typeof el.props.anchor === "string") parts.push(`text-anchor="${escapeAttr(el.props.anchor)}"`);
    if (typeof el.props.styleName === "string") parts.push(`font-style="${escapeAttr(el.props.styleName)}"`);
  }

  const motion = isMotionResult(el.props.motion) ? el.props.motion : undefined;
  const authored = serializeStyle(el.props.style);
  const styleParts = [
    namespace === "html" || (el.type === "Vector" && !isRoot)
      ? layoutStyle(el.layout, parentLayout)
      : "",
    textPaintStyle(el, canvasWidth),
    motion ? composeWithMotion(authored, motion) : authored,
  ].filter(Boolean);
  if (typeof el.props.fill === "string" && PRIMITIVE_TAG[el.type]) {
    styleParts.unshift(css({ background: el.props.fill }));
  }
  if (el.type === "Fill") {
    const bg = fillBackground(el);
    if (bg) styleParts.unshift(css({ background: bg }));
  }
  if (typeof el.props.color === "string" && el.type === "Text") {
    styleParts.unshift(css({ color: el.props.color }));
  }
  if (typeof el.props.radius === "number" || typeof el.props.radius === "string") {
    const r = el.props.radius;
    styleParts.unshift(
      css({ borderRadius: typeof r === "number" ? r : r }),
    );
  }
  if (typeof el.props.border === "string") {
    styleParts.unshift(`border:${el.props.border}`);
  }
  if (typeof el.props.overflow === "string") {
    styleParts.unshift(css({ overflow: el.props.overflow }));
  }
  if (styleParts.length) {
    parts.push(`style="${escapeAttr(styleParts.join(";"), requirePurification)}"`);
  }

  for (const [key, value] of Object.entries(el.props)) {
    // Raw SVG tags carry SVG attributes, not the typed Vector props with the
    // same names. In particular, a pattern's viewBox must survive import.
    const rawSvgViewportAttr = rawSvg && (key === "viewBox" || key === "preserveAspectRatio");
    if ((!rawSvgViewportAttr && (namespace === "svg" ? VECTOR_SKIP_ATTR : SKIP_ATTR).has(key)) || key === "id") continue;
    if (el.type === "Vector" && (key === "width" || key === "height")) continue;
    if (value == null || value === false) continue;
    if (namespace === "svg" && key === "points" && Array.isArray(value)) {
      if (requirePurification && !escapedAttributeName("points")) requirePurification();
      parts.push(`points="${escapeAttr(formatVectorPoints(value as VectorPointsValue), requirePurification)}"`);
      continue;
    }
    if (typeof value === "object") continue;
    const painted = (key === "fill" || key === "stroke") && typeof value === "string"
      ? paintDefinitionRef(value, paintDefs) ?? value
      : value;
    const attr = namespace === "svg" ? (SVG_ATTR[key] ?? key) : key === "className" ? "class" : key;
    if (requirePurification && !escapedAttributeName(attr)) requirePurification();
    if (painted === true) {
      parts.push(namespace === "svg" ? `${attr}="true"` : attr);
      continue;
    }
    parts.push(`${attr}="${escapeAttr(String(painted), requirePurification)}"`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function lowerChild(
  child: MediaChild,
  namespace: MarkupNamespace,
  parent: MediaElement | undefined,
  canvasWidth: number,
  requirePurification: PurificationObserver,
  paintDefs: ReadonlySet<string> | undefined,
): string {
  if (child === null || child === undefined || child === false || child === true) {
    return "";
  }
  if (typeof child === "number") return escapeHtml(String(child));
  if (typeof child === "string") return escapeHtml(child);
  if (Array.isArray(child)) return serializeChildren(child, namespace, parent, canvasWidth, requirePurification, paintDefs);
  if (isMediaElement(child)) return serialize(child, namespace, parent, canvasWidth, false, requirePurification, paintDefs);
  return "";
}

/** Arrays contribute ordered children, never caller-owned aggregation methods. */
function serializeChildren(
  children: readonly MediaChild[],
  namespace: MarkupNamespace,
  parent: MediaElement | undefined,
  canvasWidth: number,
  requirePurification: PurificationObserver,
  paintDefs: ReadonlySet<string> | undefined,
): string {
  let html = "";
  for (let index = 0; index < children.length; index++) {
    if (index in children) html += lowerChild(children[index], namespace, parent, canvasWidth, requirePurification, paintDefs);
  }
  return html;
}

function fillBackground(el: MediaElement): string {
  const gradient = el.props.gradient;
  if (gradient && typeof gradient === "object" && !Array.isArray(gradient)) {
    const g = gradient as {
      kind?: string;
      at?: string;
      size?: string;
      angle?: number | string;
      stops?: string[];
    };
    const stops = Array.isArray(g.stops) ? g.stops.join(", ") : "";
    if (g.kind === "radial") {
      const size = g.size ? `${g.size} ` : "";
      return `radial-gradient(ellipse ${size}at ${g.at ?? "50% 50%"}, ${stops})`;
    }
    const angle = typeof g.angle === "number" ? `${g.angle}deg` : g.angle ?? "180deg";
    return `linear-gradient(${angle}, ${stops})`;
  }
  if (typeof el.props.color === "string") return el.props.color;
  if (typeof el.props.fill === "string") return el.props.fill;
  return "";
}

function serializeImage(el: MediaElement, attrs: string): string {
  const src = typeof el.props.src === "string" ? el.props.src : "";
  const fit = typeof el.props.fit === "string" ? el.props.fit : "cover";
  const kb = el.props.kenBurns;
  const kbObj =
    typeof kb === "number"
      ? { progress: kb }
      : kb && typeof kb === "object"
        ? (kb as {
            progress: number;
            zoomFrom?: number;
            zoomTo?: number;
            overlay?: string;
            position?: string;
            overflow?: number;
          })
        : undefined;
  if (kbObj) {
    const t = Math.max(0, Math.min(1, kbObj.progress));
    const zoomFrom = kbObj.zoomFrom ?? 1;
    const zoomTo = kbObj.zoomTo ?? 1.1;
    const zoom = zoomFrom + (zoomTo - zoomFrom) * t;
    const overflow = kbObj.overflow ?? 50;
    const overlay = kbObj.overlay ?? (typeof el.props.overlay === "string" ? el.props.overlay : "rgba(0,0,0,0.5)");
    const position = kbObj.position ?? "center";
    const bg = css({
      position: "absolute",
      inset: -overflow,
      backgroundImage: `url(${src})`,
      backgroundSize: "cover",
      backgroundPosition: position,
      transform: `scale(${zoom})`,
      transformOrigin: "center center",
    });
    const over = css({ position: "absolute", inset: 0, background: overlay });
    return `<div${attrs}><div style="${escapeAttr(bg)}"></div><div style="${escapeAttr(over)}"></div></div>`;
  }
  const imgStyle = css({ width: "100%", height: "100%", objectFit: fit, display: "block" });
  return `<div${attrs}><img src="${escapeAttr(src)}" style="${escapeAttr(imgStyle)}" /></div>`;
}

function serializePlate(el: MediaElement, attrs: string): string {
  const src = typeof el.props.src === "string" ? el.props.src : "";
  const fit = typeof el.props.fit === "string" ? el.props.fit : "cover";
  const style = css({
    width: "100%",
    height: "100%",
    backgroundRepeat: "no-repeat",
    backgroundSize: fit === "contain" ? "contain" : "cover",
  });
  return `<div${attrs} data-superimg-plate="${escapeAttr(src)}" style="${escapeAttr(style)}"></div>`;
}

function serializeVideo(el: MediaElement, attrs: string): string {
  if (typeof el.props.html === "string") {
    return `<div${attrs}>${el.props.html}</div>`;
  }
  const src = typeof el.props.src === "string" ? el.props.src : "";
  const fit = typeof el.props.fit === "string" ? el.props.fit : "cover";
  const style = css({ width: "100%", height: "100%", objectFit: fit, display: "block" });
  return `<div${attrs}><video src="${escapeAttr(src)}" style="${escapeAttr(style)}" playsinline muted></video></div>`;
}

function serialize(
  el: MediaElement,
  parentNamespace: MarkupNamespace,
  parent: MediaElement | undefined,
  canvasWidth: number,
  isRoot: boolean,
  requirePurification: PurificationObserver,
  inheritedPaintDefs?: ReadonlySet<string>,
): string {
  const namespace: MarkupNamespace = el.type === "Vector" ? "svg" : parentNamespace;
  const paintDefs = el.type === "Vector" ? paintDefinitionIds(el) : inheritedPaintDefs;
  const tag = tagName(el, namespace, requirePurification);
  const attrs = serializeAttrs(el, namespace, parent?.layout, canvasWidth, isRoot, requirePurification, paintDefs);
  if (el.type === "Image") { requirePurification?.(); return serializeImage(el, attrs); }
  if (el.type === "Video") { requirePurification?.(); return serializeVideo(el, attrs); }
  if (el.type === "Plate") { requirePurification?.(); return serializePlate(el, attrs); }
  if (
    (el.type === "Html" || el.type === "Code") &&
    typeof el.props.html === "string"
  ) {
    requirePurification?.();
    const reveal = el.type === "Code" ? clampReveal(el.props.reveal) : undefined;
    const htmlContent = reveal !== undefined && reveal < 1
      ? sliceHighlightedCodeHtml(
          el.props.html,
          typeof el.props.code === "string" ? el.props.code : undefined,
          reveal,
        )
      : el.props.html;
    return `<${tag}${attrs}>${htmlContent}</${tag}>`;
  }
  const explicitText = namespace === "html" ? laidOutTextHtml(el, canvasWidth, requirePurification) : undefined;
  const childNamespace = namespace === "svg" && el.type === "foreignObject" ? "html" : namespace;
  const inner = explicitText ?? serializeChildren(revealChildren(el), childNamespace, el, canvasWidth, requirePurification, paintDefs);
  if (namespace === "html" && HTML_VOID.has(tag.toLowerCase()) && !inner) {
    return `<${tag}${attrs}>`;
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/**
 * Lower a semantic render tree to an HTML or SVG string.
 */
export function lower(node: MediaNode, options: LowerOptions | "html" | "svg" = "html"): string {
  const opts: LowerOptions = typeof options === "string" ? { medium: options } : options;
  const medium = opts.medium ?? "html";
  const canvasWidth = opts.width ?? 1920;
  let purificationReported = false;
  const requirePurification = opts.onPurificationRequired || opts.onSerializationComplete ? () => {
    if (purificationReported) return;
    purificationReported = true;
    opts.onPurificationRequired?.();
  } : undefined;
  const laidOut = layoutTree(node, {
    ...(opts.width !== undefined ? { width: opts.width } : {}),
    ...(opts.height !== undefined ? { height: opts.height } : {}),
    ...(opts.measurer !== undefined ? { measurer: opts.measurer } : {}),
  });
  const html = serialize(laidOut, medium, undefined, canvasWidth, true, requirePurification);
  opts.onSerializationComplete?.(!purificationReported);
  return html;
}

/** Already-laid-out Vector subtree as real SVG. `lowerSvg` supplies absolute x/y. */
export function lowerLaidOutVector(el: MediaElement, canvasWidth: number): string {
  const { x: _x, y: _y, ...props } = el.props;
  return serialize({ ...el, props }, "svg", undefined, canvasWidth, true, undefined);
}
