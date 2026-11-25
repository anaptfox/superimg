//! Stage fill, text contrast, and sparse focal ink over walked media trees.

import type { BackgroundValue, ValidationIssue } from "@superimg/types";

const TEXT_TAGS = new Set(["Text", "VectorText", "text", "p", "span", "h1", "h2", "h3", "label"]);
const FILL_TAGS = new Set(["Fill"]);
const FOCAL_TAGS = new Set(["Text", "p", "span", "h1", "h2", "h3", "label", "Image", "Video"]);
const CONTRAST_MIN = 3;
/** Square chat stills fail when measurable ink covers less than this fraction of the stage. */
export const SPARSE_FOCAL_MIN = 0.12;

export interface PaintScanNode {
  tag: string;
  role?: string;
  namespace?: "html" | "svg";
  color?: string;
  id?: string;
  path?: string;
  depth?: number;
  parentPath?: string;
  geometry?: { valid?: boolean };
  paint?: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; fillOpacity?: number; complex?: boolean };
  relations?: { mask?: string; filter?: string };
  layout?: { x: number; y: number; width: number; height: number };
  bounds?: { x: number; y: number; width: number; height: number };
  spatial?: { bounds: { x: number; y: number; width: number; height: number }; supported: boolean; clip?: { x: number; y: number; width: number; height: number }; hidden: boolean };
  textGeometry?: { content: { x: number; y: number; width: number; height: number } };
}

export interface PaintScanLocation {
  frame: number;
  progress: number;
  width?: number;
  height?: number;
  /** Resolved config background. Any non-empty value paints the stage; only a hex color is a contrast floor. */
  background?: string;
}

/** String passed to {@link scanTreePaintIssues}. Image backgrounds stay non-colors so they paint without setting contrast. */
export function stageBackground(background: BackgroundValue | undefined): string | undefined {
  if (typeof background !== "string") {
    if (background === undefined || background.src.trim().length === 0) return undefined;
    return "image";
  }
  const trimmed = background.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function inspectAt(progress: number): string {
  const label = Number.isInteger(progress)
    ? String(progress)
    : progress.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `superimg inspect <template> --at ${label} --png`;
}

function parseHex(color: string): [number, number, number] | null {
  const raw = color.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (short?.[1]) {
    const [r, g, b] = short[1].split("");
    return [parseInt(r! + r, 16), parseInt(g! + g, 16), parseInt(b! + b, 16)];
  }
  const long = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (long?.[1]) {
    return [
      parseInt(long[1].slice(0, 2), 16),
      parseInt(long[1].slice(2, 4), 16),
      parseInt(long[1].slice(4, 6), 16),
    ];
  }
  return null;
}

function luminance(rgb: [number, number, number]): number {
  const lin = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrastRatio(a: string, b: string): number | null {
  const left = parseHex(a);
  const right = parseHex(b);
  if (!left || !right) return null;
  const L1 = luminance(left);
  const L2 = luminance(right);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function strokedText(node: PaintScanNode): boolean {
  return !!node.paint?.stroke && node.paint.stroke !== "none" && (node.paint.strokeWidth ?? 1) > 0;
}

function plainColor(color: string | undefined): string | undefined {
  if (color === undefined) return undefined;
  const trimmed = color.trim();
  return parseHex(trimmed) ? trimmed : undefined;
}

function fullBleedFill(
  nodes: readonly PaintScanNode[],
  stage: { width: number; height: number },
): string | undefined {
  for (const node of nodes) {
    if (!FILL_TAGS.has(node.tag) || !node.paint?.fill) continue;
    const box = boxOf(node);
    if (box && isFullBleed(box, stage)) return node.paint.fill;
  }
  return undefined;
}

function stageColor(nodes: readonly PaintScanNode[], loc: PaintScanLocation): string | undefined {
  if (loc.width !== undefined && loc.height !== undefined && loc.width > 0 && loc.height > 0) {
    const bleed = fullBleedFill(nodes, { width: loc.width, height: loc.height });
    if (bleed) return bleed;
  }
  const background = plainColor(loc.background);
  if (background) return background;
  const fill = nodes.find((node) => FILL_TAGS.has(node.tag) && node.paint?.fill);
  if (fill?.paint?.fill) return fill.paint.fill;
  const painted = nodes.find((node) => node.paint?.fill && node.depth === 0);
  return painted?.paint?.fill;
}

function hasPaintedStage(nodes: readonly PaintScanNode[], background: string | undefined): boolean {
  if (background !== undefined && background.trim().length > 0) return true;
  return nodes.some(
    (node) =>
      FILL_TAGS.has(node.tag) ||
      (typeof node.paint?.fill === "string" && node.paint.fill.length > 0) ||
      node.tag === "Html",
  );
}

function boxOf(node: PaintScanNode): { x: number; y: number; width: number; height: number } | undefined {
  const box = node.layout ?? node.bounds;
  if (!box) return undefined;
  if (!(box.width > 0) || !(box.height > 0)) return undefined;
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function isFullBleed(box: { width: number; height: number }, stage: { width: number; height: number }): boolean {
  return box.width * box.height >= stage.width * stage.height * 0.9;
}

function textFloor(nodes: readonly PaintScanNode[], node: PaintScanNode, loc: PaintScanLocation, byPath: ReadonlyMap<string, PaintScanNode>, indices: ReadonlyMap<PaintScanNode, number>): { color?: string; reason?: string; provider?: string } {
  const box = node.textGeometry?.content ?? node.spatial?.bounds ?? boxOf(node);
  // Older scans without structural bounds retain their historical stage fallback.
  if (!node.path || !box) {
    const color = stageColor(nodes, loc);
    return color === undefined ? {} : { color };
  }
  if (node.spatial?.supported === false) return { reason: "unsupported-transform" };
  let color = plainColor(loc.background);
  let reason = loc.background && !color ? "complex-stage" : undefined;
  let provider: string | undefined;
  const index = indices.get(node) ?? -1;
  for (let i = 0; i < index; i++) {
    const candidate = nodes[i]!;
    if (candidate.spatial?.hidden || candidate.paint?.opacity === 0) continue;
    if (!candidate.paint?.complex && (candidate.paint?.fill === "none" || candidate.paint?.fill === "transparent")) continue;
    const painting = candidate.paint?.fill || candidate.paint?.complex || ["Image", "Video", "Plate", "Html"].includes(candidate.tag);
    if (!painting || candidate.tag === "Text" || candidate.role === "Text") continue;
    if (candidate.tag.startsWith("Vector") && candidate.tag !== "VectorPath") continue;
    let bounds = candidate.spatial?.bounds ?? boxOf(candidate);
    if (!bounds) { reason = "unknown-background-bounds"; color = undefined; continue; }
    if (candidate.spatial?.clip) {
      const c = candidate.spatial.clip, x = Math.max(bounds.x, c.x), y = Math.max(bounds.y, c.y);
      bounds = { x, y, width: Math.max(0, Math.min(bounds.x + bounds.width, c.x + c.width) - x), height: Math.max(0, Math.min(bounds.y + bounds.height, c.y + c.height) - y) };
    }
    const overlaps = bounds.x < box.x + box.width && bounds.x + bounds.width > box.x && bounds.y < box.y + box.height && bounds.y + bounds.height > box.y;
    if (!overlaps) continue;
    const covers = bounds.x <= box.x && bounds.y <= box.y && bounds.x + bounds.width >= box.x + box.width && bounds.y + bounds.height >= box.y + box.height;
    let ancestorComplex = false;
    let parentPath = candidate.parentPath;
    while (parentPath) {
      const parent = byPath.get(parentPath);
      if (!parent) { ancestorComplex = true; break; }
      if (parent.paint?.complex || parent.paint?.opacity !== undefined && parent.paint.opacity !== 1 || parent.relations?.mask || parent.relations?.filter) { ancestorComplex = true; break; }
      parentPath = parent.parentPath;
    }
    if (!covers || candidate.tag === "VectorPath" || candidate.tag === "path" || candidate.spatial?.supported === false || ancestorComplex || (candidate.paint?.opacity ?? 1) !== 1 || candidate.paint?.complex || !plainColor(candidate.paint?.fill)) {
      color = undefined; reason = !covers ? "partially-covered" : "complex-background"; provider = candidate.id ?? candidate.path; continue;
    }
    color = plainColor(candidate.paint?.fill); reason = undefined; provider = candidate.id ?? candidate.path;
  }
  for (let i = index + 1; i < nodes.length; i++) {
    const later = nodes[i]!;
    if (later.spatial?.hidden || later.paint?.opacity === 0 || later.path?.startsWith(`${node.path}.`)) continue;
    if (!later.paint?.complex && (later.paint?.fill === "none" || later.paint?.fill === "transparent")) continue;
    if (!(later.paint?.fill || later.paint?.complex || ["Image", "Video", "Plate", "Html"].includes(later.tag)) || later.tag === "Text" || later.role === "Text" || (later.namespace === "svg" && later.tag !== "VectorPath" && later.tag !== "path")) continue;
    let bounds = later.spatial?.bounds ?? boxOf(later);
    if (bounds && later.spatial?.clip) {
      const c = later.spatial.clip, x = Math.max(bounds.x, c.x), y = Math.max(bounds.y, c.y);
      bounds = { x, y, width: Math.max(0, Math.min(bounds.x + bounds.width, c.x + c.width) - x), height: Math.max(0, Math.min(bounds.y + bounds.height, c.y + c.height) - y) };
    }
    if (bounds && bounds.x < box.x + box.width && bounds.x + bounds.width > box.x && bounds.y < box.y + box.height && bounds.y + bounds.height > box.y) return { reason: "later-paint-may-occlude", ...((later.id ?? later.path) ? { provider: (later.id ?? later.path)! } : {}) };
  }
  return { ...(color ? { color } : {}), ...(reason ? { reason } : {}), ...(provider ? { provider } : {}) };
}

/** Vector bounds are already projected into stage coordinates by walkMediaTree.
 * Definitions and fully hidden ancestor groups cannot contribute visible ink. */
function paintedVector(node: PaintScanNode, nodes: readonly PaintScanNode[]): boolean {
  if (node.tag !== "VectorPath" && node.tag !== "path") return false;
  if (node.geometry?.valid === false || node.paint?.opacity === 0) return false;
  const fill = node.paint?.fill;
  // A stroke-only path has no measurable fill area in this source estimate.
  if (!(fill && fill !== "none" && fill !== "transparent")) return false;
  for (const ancestor of nodes) {
    if (!node.path || !ancestor.path || !node.path.startsWith(`${ancestor.path}.`)) continue;
    if (["VectorDefs", "VectorMask", "VectorClip", "defs", "mask", "clipPath"].includes(ancestor.tag) || ancestor.paint?.opacity === 0) return false;
  }
  return true;
}

function isFocal(node: PaintScanNode, stage: { width: number; height: number }): boolean {
  if (TEXT_TAGS.has(node.tag) || node.role === "Text" || FOCAL_TAGS.has(node.tag)) {
    return true;
  }
  if (!FILL_TAGS.has(node.tag)) return false;
  const box = boxOf(node);
  return box !== undefined && !isFullBleed(box, stage);
}

interface InkRect { x: number; y: number; width: number; height: number }
function visibleRect(box: InkRect, width: number, height: number): InkRect | undefined {
  const x = Math.max(0,box.x), y = Math.max(0,box.y);
  const right = Math.min(width,box.x+box.width), bottom = Math.min(height,box.y+box.height);
  return right > x && bottom > y ? {x,y,width:right-x,height:bottom-y} : undefined;
}
/** Union prevents a contour, undercoat and many overlapping facet bins from
 * multiplying the same area. These remain source bounding estimates. */
function unionArea(rects: readonly InkRect[]): number {
  const edges = [...new Set(rects.flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);
  let area=0;
  for(let i=1;i<edges.length;i++) {
    const left=edges[i-1]!,right=edges[i]!;
    const spans=rects.filter(r=>r.x<right&&r.x+r.width>left).map(r=>[r.y,r.y+r.height] as const).sort((a,b)=>a[0]-b[0]);
    let height=0,start=0,end=0;
    for(const span of spans){if(span[0]>end){height+=end-start;start=span[0];end=span[1];}else end=Math.max(end,span[1]);}
    area+=(right-left)*(height+end-start);
  }
  return area;
}

export function scanTreePaintIssues(
  nodes: readonly PaintScanNode[],
  loc: PaintScanLocation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byPath = new Map(nodes.filter(node => node.path !== undefined).map(node => [node.path!, node]));
  const indices = new Map(nodes.map((node, index) => [node, index]));
  const texts = nodes.filter(node => (TEXT_TAGS.has(node.tag) || node.role === "Text") && !node.spatial?.hidden && node.paint?.opacity !== 0 && ((node.paint?.fillOpacity !== 0 && node.color !== "none") || strokedText(node)) && !nodes.some(parent => node.path?.startsWith(`${parent.path}.`) && (["VectorDefs", "VectorMask", "VectorClip", "defs", "mask", "clipPath"].includes(parent.tag) || parent.paint?.opacity === 0)));
  const hasText = texts.length > 0;
  if (hasText && !hasPaintedStage(nodes, loc.background)) {
    issues.push({
      severity: "error",
      code: "UNPAINTED_STAGE",
      message: "Text has no stage Fill or background; export can look blank",
      frame: loc.frame,
      progress: loc.progress,
      suggestion: `Paint a Fill (paper/ink) or set config.background. Reproduce: ${inspectAt(loc.progress)}`,
    });
  }

    for (const [index, node] of texts.entries()) {
      if (!node.color || ((node.color === "none" || node.paint?.fillOpacity === 0) && !strokedText(node))) continue;
      const resolved = textFloor(nodes, node, loc, byPath, indices), floor = resolved.color;
      const complex = node.paint?.complex || strokedText(node) || !floor || !plainColor(node.color) || (node.paint?.opacity ?? 1) !== 1 || (node.paint?.fillOpacity ?? 1) !== 1 || node.relations?.mask || node.relations?.filter || nodes.some(parent => node.path?.startsWith(`${parent.path}.`) && (parent.paint?.complex || parent.relations?.mask || parent.relations?.filter || (parent.paint?.opacity !== undefined && parent.paint.opacity !== 1)));
      if (complex) {
        if (hasPaintedStage(nodes, loc.background)) issues.push({ severity: "warning", code: "TEXT_PAINT_UNVERIFIED", message: "Text contrast requires browser/compositing evidence for this paint", frame: loc.frame, progress: loc.progress, ...(node.id ? { nodeId: node.id } : {}), nodePath: node.path ?? `/${index}`, details: { reason: resolved.reason ?? "complex-or-unknown-paint" } });
        continue;
      }
      const ratio = contrastRatio(node.color, floor);
      if (ratio !== null && ratio < CONTRAST_MIN) {
        issues.push({
          severity: "error",
          code: "LOW_CONTRAST_TEXT",
          message: `Text ${node.color} on ${floor} contrast ${ratio.toFixed(2)} (< ${CONTRAST_MIN})`,
          frame: loc.frame,
          progress: loc.progress,
          suggestion: `Set Text color against its resolved background. Reproduce: ${inspectAt(loc.progress)}`,
          ...(node.id !== undefined ? { nodeId: node.id } : {}),
          nodePath: node.path ?? `/${index}`,
          details: { text: node.color, floor, ratio, ...(resolved.provider ? { backgroundProvider: resolved.provider } : {}) },
        });
      }
    }

  const width = loc.width;
  const height = loc.height;
  if (width !== undefined && height !== undefined && width === height && width > 0) {
    const stage = { width, height };
    const stageArea = width * height;
    const rects: InkRect[] = [];
    const opaqueRects: InkRect[] = [];
    let measured = 0;
    for (const node of nodes) {
      // Html can contain WebGL or other executable artwork. Its box is an
      // upper bound, not measured ink: do not call the unobserved interior empty.
      if (node.tag === "Html" && node.paint?.opacity !== 0 && !nodes.some(parent =>
        parent.path !== undefined && node.path?.startsWith(`${parent.path}.`) && parent.paint?.opacity === 0)) {
        const box = boxOf(node);
        const visible = box && visibleRect(box, width, height);
        if (visible) opaqueRects.push(visible);
      }
      if ((TEXT_TAGS.has(node.tag) || node.role === "Text") && !texts.includes(node)) continue;
      const isVector = paintedVector(node, nodes);
      if (!isFocal(node, stage) && !isVector) continue;
      const box = isVector ? node.bounds : boxOf(node);
      if (!box) continue;
      const visible = visibleRect(box,width,height);
      if (!visible) continue;
      measured += 1;
      rects.push(visible);
    }
    if (measured > 0 || opaqueRects.length > 0) {
      const occupied = Math.min(unionArea(rects), stageArea);
      const fraction = occupied / stageArea;
      if (fraction < SPARSE_FOCAL_MIN) {
        const possibleFraction = Math.min(unionArea([...rects, ...opaqueRects]), stageArea) / stageArea;
        if (opaqueRects.length > 0 && possibleFraction >= SPARSE_FOCAL_MIN) {
          issues.push({
            severity: "warning", code: "FOCAL_COVERAGE_UNVERIFIED",
            message: "Opaque artwork prevents a source-only focal coverage verdict",
            frame: loc.frame, progress: loc.progress,
            suggestion: `Review rendered pixels at the selected edition and frame. Reproduce: ${inspectAt(loc.progress)}`,
            details: { fraction, possibleFraction, measured, opaqueRegions: opaqueRects.length, width, height, estimate: "source-bounds-with-opaque-interiors" },
          });
          return issues;
        }
        issues.push({
          severity: "error",
          code: "SPARSE_FOCAL",
          message: `${opaqueRects.length ? "Focal bounds occupy at most" : "Ink occupies"} ${((opaqueRects.length ? possibleFraction : fraction) * 100).toFixed(1)}% of the ${width}×${height} stage (< ${SPARSE_FOCAL_MIN * 100}%)`,
          frame: loc.frame,
          progress: loc.progress,
          suggestion: `Design a square edition with one focal. Do not letterbox landscape art into 1080×1080. Reproduce: ${inspectAt(loc.progress)}`,
          details: { fraction, measured, width, height, estimate: "union-of-source-bounds" },
        });
      }
    }
  }

  return issues;
}
