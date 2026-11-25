import { isMediaElement, type CanvasSize, type MediaChild } from "@superimg/types";
import { BadTransform, IDENTITY, apply, mul, parseTransform, typedTransform, type Matrix } from "./transform.js";
import type { Point, ShotArt } from "./types.js";

// What a bubble paints, in output pixels. Typed vector children and raw SVG
// markup are lowered to one small tree, then measured with the same rules:
// transforms compose, opacity 0 and display none paint nothing, clips cut,
// and text is estimated from its anchor and font size.

type Value = string | number | boolean | undefined;
type Node = { tag: string; attrs: Record<string, Value>; children: Node[]; text: string };
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Painted = { box: Box | undefined; unparseable: boolean };

const TEXT_EM = 0.55; // average glyph advance, as the stdlib walker estimates it
const UNPAINTED = new Set(["defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "pattern", "filter", "title", "desc", "use", "style"]);

class Unmeasurable extends BadTransform {}

const typed: Record<string, string> = {
  Vector: "g", VectorGroup: "g", VectorRect: "rect", VectorCircle: "circle", VectorEllipse: "ellipse",
  VectorLine: "line", VectorPolyline: "polyline", VectorPolygon: "polygon", VectorPath: "path",
  VectorImage: "image", VectorText: "text", VectorRun: "tspan", VectorClip: "clipPath", VectorMask: "mask", VectorDefs: "defs",
};

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const id = (value: Value) => typeof value === "string" ? /^url\(\s*['"]?#?([^)'"\s]+)['"]?\s*\)$/.exec(value)?.[1] ?? value.replace(/^#/, "") : undefined;

function fromTyped(child: MediaChild, out: Node[]) {
  if (Array.isArray(child)) { for (const part of child) fromTyped(part, out); return; }
  if (typeof child === "string" || typeof child === "number") {
    out.push({ tag: "#text", attrs: {}, children: [], text: String(child) });
    return;
  }
  if (!isMediaElement(child)) return;
  const tag = typed[child.type];
  if (!tag) return;
  const attrs: Record<string, Value> = {};
  for (const [key, value] of Object.entries(child.props)) {
    if (value === undefined || value === null) continue;
    if (key === "transform") attrs.transform = typedTransform(value);
    else if (key === "size") attrs.fontSize = value as number;
    else if (key === "anchor") attrs.textAnchor = value as string;
    else if (key === "clip") attrs.clipPath = value as string;
    else if (typeof value === "object") continue;
    else attrs[key] = value as Value;
  }
  const children: Node[] = [];
  for (const part of child.children) fromTyped(part, children);
  out.push({ tag, attrs, children, text: "" });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) =>
  name[0] === "#" ? String.fromCodePoint(name[1]!.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : ENTITIES[name] ?? whole);

// The overlay markup is placed inside a browser SVG, so it is read as a browser
// would: any element, `style` attribute or reference is accepted. Only broken
// syntax (an unfinished tag, a mismatched close, an unclosed element) cannot be
// placed, and that is what makes a bubble unparseable.
const MARKUP = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^\s>]+)\s*>|<([A-Za-z][^\s/>]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|<\?[\s\S]*?\?>|([^<]+)|(<)/g;
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function fromMarkup(markup: string): Node[] {
  const root: Node = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const text = (value: string) => stack.at(-1)!.children.push({ tag: "#text", attrs: {}, children: [], text: value });
  for (const [whole, cdata, close, open, attributes, selfClosing, chunk, stray] of markup.matchAll(MARKUP)) {
    if (stray) throw new Unmeasurable(whole);
    if (chunk !== undefined) text(decode(chunk));
    else if (cdata !== undefined) text(cdata);
    else if (close !== undefined) {
      if (stack.length < 2 || stack.at(-1)!.tag !== close.replace(/^[^:]*:/, "")) throw new Unmeasurable(whole);
      stack.pop();
    } else if (open !== undefined) {
      const attrs: Record<string, Value> = {};
      for (const [, name, double, single, bare] of (attributes ?? "").matchAll(ATTRIBUTE)) {
        attrs[camel(name!.replace(/^[^:]*:(?=[^:]+$)/, ""))] = decode(double ?? single ?? bare ?? "");
      }
      if (typeof attrs.style === "string") {
        for (const declaration of attrs.style.split(";")) {
          const [key, ...rest] = declaration.split(":");
          if (key && rest.length) attrs[camel(key.trim())] = rest.join(":").trim();
        }
      }
      const node: Node = { tag: open.replace(/^[^:]*:/, ""), attrs, children: [], text: "" };
      stack.at(-1)!.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  if (stack.length !== 1) throw new Unmeasurable("unclosed element");
  return root.children;
}

const num = (value: Value, fallback = 0) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(parseFloat(value))) return parseFloat(value);
  return fallback;
};

function points(value: Value) {
  const n = String(value ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
}

function arc(x1: number, y1: number, rxIn: number, ryIn: number, degrees: number, large: number, sweep: number, x2: number, y2: number) {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x2, y2]] as [number, number][];
  const phi = degrees * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p / rx) ** 2 + (y1p / ry) ** 2;
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = factor * rx * y1p / ry, cyp = -factor * ry * x1p / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const value = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return value;
  };
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const out: [number, number][] = [];
  for (let i = 1; i <= 24; i++) {
    const a = start + delta * i / 24;
    out.push([cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos]);
  }
  return out;
}

function pathPoints(d: string) {
  const out: [number, number][] = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0, command = "", x = 0, y = 0, sx = 0, sy = 0, cx2 = 0, cy2 = 0, previous = "";
  const read = () => {
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Unmeasurable(d);
    return value;
  };
  const isCommand = (token: string | undefined) => token !== undefined && /^[A-Za-z]$/.test(token);
  const sample = (p0: [number, number], controls: [number, number][]) => {
    const all = [p0, ...controls];
    for (let s = 1; s <= 24; s++) {
      const t = s / 24;
      let level = all;
      while (level.length > 1) level = level.slice(1).map((q, k) => [level[k]![0] + (q[0] - level[k]![0]) * t, level[k]![1] + (q[1] - level[k]![1]) * t] as [number, number]);
      out.push(level[0]!);
    }
  };
  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++]!;
    else if (command === "") throw new Unmeasurable(d);
    else if (command === "M") command = "L"; else if (command === "m") command = "l";
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0, oy = relative ? y : 0;
    switch (command.toUpperCase()) {
      case "M": x = ox + read(); y = oy + read(); sx = x; sy = y; out.push([x, y]); break;
      case "L": x = ox + read(); y = oy + read(); out.push([x, y]); break;
      case "H": x = ox + read(); out.push([x, y]); break;
      case "V": y = oy + read(); out.push([x, y]); break;
      case "C": {
        const c1: [number, number] = [ox + read(), oy + read()], c2: [number, number] = [ox + read(), oy + read()];
        const end: [number, number] = [ox + read(), oy + read()];
        sample([x, y], [c1, c2, end]); [x, y] = end; [cx2, cy2] = c2; break;
      }
      case "S": {
        const c1: [number, number] = /[CcSs]/.test(previous) ? [2 * x - cx2, 2 * y - cy2] : [x, y];
        const c2: [number, number] = [ox + read(), oy + read()], end: [number, number] = [ox + read(), oy + read()];
        sample([x, y], [c1, c2, end]); [x, y] = end; [cx2, cy2] = c2; break;
      }
      case "Q": {
        const c1: [number, number] = [ox + read(), oy + read()], end: [number, number] = [ox + read(), oy + read()];
        sample([x, y], [c1, end]); [x, y] = end; [cx2, cy2] = c1; break;
      }
      case "T": {
        const c1: [number, number] = /[QqTt]/.test(previous) ? [2 * x - cx2, 2 * y - cy2] : [x, y];
        const end: [number, number] = [ox + read(), oy + read()];
        sample([x, y], [c1, end]); [x, y] = end; [cx2, cy2] = c1; break;
      }
      case "A": {
        const rx = read(), ry = read(), rotation = read();
        const flag = () => { const token = tokens[i]!; if (token.length > 1 && /^[01]/.test(token)) { tokens[i] = token.slice(1); return Number(token[0]); } return read(); };
        const large = flag(), sweep = flag();
        const end: [number, number] = [ox + read(), oy + read()];
        out.push(...arc(x, y, rx, ry, rotation, large, sweep, end[0], end[1])); [x, y] = end; break;
      }
      case "Z": x = sx; y = sy; break;
      default: throw new Unmeasurable(d);
    }
    previous = command;
  }
  return out;
}

const union = (a: Box | undefined, b: Box | undefined): Box | undefined =>
  !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
const intersect = (a: Box, b: Box): Box | undefined => {
  const box = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return box.x0 <= box.x1 && box.y0 <= box.y1 ? box : undefined;
};
const boxOf = (pts: readonly (readonly [number, number])[], matrix: Matrix, pad = 0): Box | undefined => {
  if (pts.length === 0) return undefined;
  const scale = Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));
  let box: Box | undefined;
  for (const [x, y] of pts) {
    const px = matrix[0] * x + matrix[2] * y + matrix[4], py = matrix[1] * x + matrix[3] * y + matrix[5];
    box = union(box, { x0: px, y0: py, x1: px, y1: py });
  }
  return box && { x0: box.x0 - pad * scale, y0: box.y0 - pad * scale, x1: box.x1 + pad * scale, y1: box.y1 + pad * scale };
};

type Style = { fill: Value; stroke: Value; strokeWidth: number; fillOpacity: number; strokeOpacity: number };
const content = (node: Node): string => node.tag === "#text" ? node.text : node.children.map(content).join("");

function measureNode(node: Node, parent: Style, matrix: Matrix, clips: ReadonlyMap<string, Node>): Box | undefined {
  if (node.tag === "#text" || UNPAINTED.has(node.tag)) return undefined;
  const a = node.attrs;
  if (num(a.opacity, 1) <= 0 || a.display === "none" || a.visibility === "hidden" || a.visibility === "collapse") return undefined;
  if (typeof a.mask === "string" && a.mask !== "none") return undefined;
  const style: Style = {
    fill: a.fill ?? parent.fill,
    stroke: a.stroke ?? parent.stroke,
    strokeWidth: num(a.strokeWidth, parent.strokeWidth),
    fillOpacity: a.fillOpacity === undefined ? parent.fillOpacity : num(a.fillOpacity, 1),
    strokeOpacity: a.strokeOpacity === undefined ? parent.strokeOpacity : num(a.strokeOpacity, 1),
  };
  const here = mul(matrix, parseTransform(a.transform));
  const fills = style.fill !== "none" && style.fillOpacity > 0;
  const strokes = style.stroke !== undefined && style.stroke !== "none" && style.strokeOpacity > 0 && style.strokeWidth > 0;
  const pad = strokes ? style.strokeWidth / 2 : 0;
  let box: Box | undefined;
  const shape = (pts: readonly (readonly [number, number])[]) => (fills || strokes ? boxOf(pts, here, pad) : undefined);
  switch (node.tag) {
    case "g": case "svg": case "a": case "switch":
      for (const child of node.children) box = union(box, measureNode(child, style, here, clips));
      break;
    case "rect": {
      const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
      box = shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
      break;
    }
    case "image": {
      const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
      if (w > 0 && h > 0) box = boxOf([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], here);
      break;
    }
    case "circle": case "ellipse": {
      const cx = num(a.cx), cy = num(a.cy);
      const rx = node.tag === "circle" ? num(a.r) : num(a.rx), ry = node.tag === "circle" ? num(a.r) : num(a.ry);
      box = shape(Array.from({ length: 32 }, (_, k) => [cx + rx * Math.cos(k * Math.PI / 16), cy + ry * Math.sin(k * Math.PI / 16)] as [number, number]));
      break;
    }
    case "line":
      box = strokes ? boxOf([[num(a.x1), num(a.y1)], [num(a.x2), num(a.y2)]], here, pad) : undefined;
      break;
    case "polyline": case "polygon": box = shape(points(a.points)); break;
    case "path": box = shape(pathPoints(String(a.d ?? ""))); break;
    case "text": case "tspan": {
      const text = content(node);
      if (!fills || text.trim() === "" || node.tag === "tspan") break;
      const size = num(a.fontSize, 16) || 16;
      const width = text.length * size * TEXT_EM + num(a.letterSpacing) * text.length;
      const x = num(a.x), y = num(a.y);
      const left = a.textAnchor === "middle" ? x - width / 2 : a.textAnchor === "end" ? x - width : x;
      box = boxOf([[left, y - size * 0.8], [left + width, y + size * 0.2]], here);
      break;
    }
    default: break;
  }
  const clipId = id(a.clipPath);
  if (clipId !== undefined && box) {
    const clip = clips.get(clipId);
    if (clip) {
      let region: Box | undefined;
      for (const child of clip.children) region = union(region, measureNode(child, { fill: "#000", stroke: undefined, strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1 }, here, clips));
      box = region ? intersect(box, region) : undefined;
    }
  }
  return box;
}

function collectClips(nodes: readonly Node[], into: Map<string, Node>) {
  for (const node of nodes) {
    if (node.tag === "clipPath" && typeof node.attrs.id === "string") into.set(node.attrs.id, node);
    collectClips(node.children, into);
  }
}

/** The painted bounds of bubble art in output pixels; `undefined` means nothing paints. */
export function paintedBounds(art: ShotArt): Painted {
  try {
    const nodes: Node[] = [];
    if (typeof art === "string") {
      if (art.trim() !== "") nodes.push(...fromMarkup(art));
    } else {
      fromTyped(art, nodes);
    }
    const clips = new Map<string, Node>();
    collectClips(nodes, clips);
    const root: Style = { fill: undefined, stroke: undefined, strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1 };
    let box: Box | undefined;
    for (const node of nodes) box = union(box, measureNode(node, root, IDENTITY, clips));
    return { box, unparseable: false };
  } catch {
    return { box: undefined, unparseable: true };
  }
}

const EPSILON = 0.5;
export function leavesCanvas(box: Box | undefined, { width, height }: CanvasSize) {
  if (!box) return false;
  return ![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite) ||
    box.x0 < -EPSILON || box.y0 < -EPSILON || box.x1 > width + EPSILON || box.y1 > height + EPSILON;
}

export type SvgSubjectsAndHeads = {
  cast: Map<string, string>;
  props: Map<string, string>;
  heads: Map<string, Point>;
};

function parseHeadPair(value: string): { name?: string; x: number; y: number } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const colonIdx = trimmed.indexOf(":");
  const name = colonIdx > 0 ? trimmed.slice(0, colonIdx).trim() : undefined;
  const coordPart = colonIdx > 0 ? trimmed.slice(colonIdx + 1).trim() : trimmed;
  const parts = coordPart.split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return undefined;
  }
  return { ...(name ? { name } : {}), x: parts[0]!, y: parts[1]! };
}

function collectSvgSubjects(
  node: Node,
  matrix: Matrix,
  out: SvgSubjectsAndHeads,
) {
  if (node.tag === "#text" || UNPAINTED.has(node.tag)) return;
  const a = node.attrs;
  if (num(a.opacity, 1) <= 0 || a.display === "none" || a.visibility === "hidden" || a.visibility === "collapse") {
    return;
  }
  let here = matrix;
  try {
    here = mul(matrix, parseTransform(a.transform));
  } catch {
    // Keep parent matrix when an SVG element uses an unsupported CSS transform.
  }

  const castAttr = typeof a.dataSuperimgCast === "string" ? a.dataSuperimgCast.trim() : "";
  if (castAttr) {
    const key = castAttr.toLowerCase();
    if (!out.cast.has(key)) out.cast.set(key, castAttr);
  }

  const propAttr = typeof a.dataSuperimgProp === "string" ? a.dataSuperimgProp.trim() : "";
  if (propAttr) {
    const key = propAttr.toLowerCase();
    if (!out.props.has(key)) out.props.set(key, propAttr);
  }

  const headAttr = typeof a.dataSuperimgHead === "string" ? a.dataSuperimgHead.trim() : "";
  if (headAttr) {
    const parsed = parseHeadPair(headAttr);
    if (parsed) {
      const targetName = parsed.name ?? castAttr;
      if (targetName) {
        const key = targetName.toLowerCase();
        if (!out.heads.has(key)) {
          out.heads.set(key, apply(here, parsed.x, parsed.y));
        }
        if (!out.cast.has(key)) out.cast.set(key, targetName);
      }
    }
  }

  for (const child of node.children) {
    collectSvgSubjects(child, here, out);
  }
}

/**
 * Extract `data-superimg-cast`, `data-superimg-prop`, and `data-superimg-head`
 * markers from raw SVG markup, respecting hidden/zero-opacity groups and
 * composing enclosing SVG `transform` matrices into stage coordinates.
 */
export function extractSvgSubjectsAndHeads(markup: string): SvgSubjectsAndHeads {
  const out: SvgSubjectsAndHeads = {
    cast: new Map(),
    props: new Map(),
    heads: new Map(),
  };
  if (typeof markup !== "string" || markup.trim() === "") return out;
  try {
    const nodes = fromMarkup(markup);
    for (const node of nodes) {
      collectSvgSubjects(node, IDENTITY, out);
    }
  } catch {
    // Unparseable markup yields no extracted markers.
  }
  return out;
}
