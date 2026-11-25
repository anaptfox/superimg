//! Portable tree layout and semantic scanners.
import type { TreeNodeSemantics } from "@superimg/stdlib/tree";

export interface TreeCheckIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  frame?: number;
  progress?: number;
  suggestion?: string;
  nodeId?: string;
  nodePath?: string;
  relatedIds?: string[];
  details?: Record<string, unknown>;
}

export interface SemanticBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  estimated?: boolean;
}

export interface SemanticGeometry {
  kind?: string;
  d?: string;
  valid?: boolean;
  error?: string;
}

export interface SemanticRelations {
  mask?: string;
  clip?: string;
  filter?: string;
  references?: readonly string[];
}

/**
 * Optional fields added by the semantic tree walker. Keeping this intersection
 * local lets the CLI consume older captures while packages rebuild in order.
 */
export type SemanticTreeNode = Omit<TreeNodeSemantics, "relations" | "geometry" | "bounds" | "paint"> & {
  path?: string;
  parentPath?: string;
  depth?: number;
  namespace?: "html" | "svg";
  directText?: string;
  bounds?: SemanticBounds;
  paint?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    fillOpacity?: number; complex?: boolean;
  };
  geometry?: SemanticGeometry;
  relations?: SemanticRelations;
  opaque?: boolean;
};

/** Version 2 adds layout role and source-measured spatial/text geometry. */
export const INSPECT_TREE_SCHEMA_VERSION = 2 as const;

export interface InspectTreeNodeSnapshot {
  metricsExact?: boolean;
  fontFamily?: string;
  typography?: NonNullable<TreeNodeSemantics["typography"]>;
  spatial?: TreeNodeSemantics["spatial"];
  textGeometry?: TreeNodeSemantics["textGeometry"];
  layoutRole?: TreeNodeSemantics["layoutRole"];
  path: string;
  parentPath?: string;
  depth: number;
  namespace?: "html" | "svg";
  tag: string;
  id?: string;
  role?: string;
  text?: string;
  layout?: SemanticBounds;
  bounds?: SemanticBounds;
  color?: string;
  paint?: NonNullable<SemanticTreeNode["paint"]>;
  geometry?: SemanticGeometry;
  relations?: SemanticRelations;
  motion?: NonNullable<SemanticTreeNode["motion"]>;
  childCount: number;
  opaque: boolean;
}

export interface InspectTreeSnapshot {
  schemaVersion: typeof INSPECT_TREE_SCHEMA_VERSION;
  source: "tree" | "unavailable";
  roots: string[];
  coverage: {
    totalNodes: number;
    inspectableNodes: number;
    opaqueRegions: number;
    inspectableNodeRatio: number;
  };
  nodes: InspectTreeNodeSnapshot[];
}

const CONTAINERS = new Set(["Frame", "Stack", "Safe", "Vector"]);
const SKIP_ZERO = new Set(["Spacer"]);
const PATH_TAGS = new Set(["path", "Path", "VectorPath"]);
const MASK_TAGS = new Set(["mask", "Mask", "VectorMask"]);
const CLIP_TAGS = new Set(["clipPath", "Clip", "ClipPath", "VectorClip"]);
const TEXT_RUN_TAGS = new Set(["tspan", "Span", "VectorRun"]);
const VECTOR_TEXT_TAGS = new Set(["text", "VectorText"]);
const SVG_TAGS = new Set([
  "VectorCircle", "VectorRect", "VectorViewport", "VectorLinearGradient",
  "VectorStop", "VectorPattern", "VectorFilter", "VectorGaussianBlur",
  "VectorMerge", "VectorMergeNode", "VectorTurbulence", "VectorDisplacementMap",
  "Vector",
  "Group",
  "VectorGroup",
  "Path",
  "VectorPath",
  "VectorDefs",
  "Mask",
  "VectorMask",
  "Clip",
  "ClipPath",
  "VectorClip",
  "VectorText",
  "VectorRun",
  "svg",
  "g",
  "path",
  "defs",
  "mask",
  "clipPath",
  "tspan",
  "text",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "use",
  "linearGradient",
  "radialGradient",
  "stop",
  "filter",
  "foreignObject",
]);
const HTML_ONLY_TAGS = new Set([
  "Frame",
  "Stack",
  "Text",
  "Safe",
  "Spacer",
  "Fill",
  "Image",
  "Video",
  "Plate",
  "Code",
  "Html",
  "div",
  "span",
  "img",
  "video",
  "canvas",
]);

function inspectAt(progress: number): string {
  const label = Number.isInteger(progress)
    ? String(progress)
    : progress.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `superimg inspect <template> --at ${label} --png`;
}

function fallbackPath(index: number): string {
  return `/${index}`;
}

function nodePath(node: SemanticTreeNode, index: number): string {
  return node.path ?? fallbackPath(index);
}

function isOpaque(node: SemanticTreeNode): boolean {
  return node.opaque === true || node.tag === "Html";
}

export function buildInspectTreeSnapshot(
  nodes: readonly SemanticTreeNode[] | undefined,
  source: "tree" | "unavailable" = nodes ? "tree" : "unavailable",
): InspectTreeSnapshot {
  const snapshots: InspectTreeNodeSnapshot[] = (nodes ?? []).map((node, index) => ({
    path: nodePath(node, index),
    ...(node.parentPath !== undefined ? { parentPath: node.parentPath } : {}),
    depth: node.depth ?? 0,
    ...(node.namespace !== undefined ? { namespace: node.namespace } : {}),
    tag: node.tag,
    ...(node.metricsExact !== undefined ? { metricsExact: node.metricsExact } : {}),
    ...(node.fontFamily !== undefined ? { fontFamily: node.fontFamily } : {}),
    ...(node.typography !== undefined ? { typography: node.typography } : {}),
    ...(node.spatial !== undefined ? { spatial: node.spatial } : {}),
    ...(node.textGeometry !== undefined ? { textGeometry: node.textGeometry } : {}),
    ...(node.layoutRole !== undefined ? { layoutRole: node.layoutRole } : {}),
    ...(node.id !== undefined ? { id: node.id } : {}),
    ...(node.role !== undefined ? { role: node.role } : {}),
    ...((node.directText ?? node.text)
      ? { text: node.directText ?? node.text }
      : {}),
    ...(node.layout !== undefined ? { layout: node.layout } : {}),
    ...(node.bounds !== undefined ? { bounds: node.bounds } : {}),
    ...(node.color !== undefined ? { color: node.color } : {}),
    ...(node.paint !== undefined ? { paint: node.paint } : {}),
    ...(node.geometry !== undefined ? { geometry: node.geometry } : {}),
    ...(node.relations !== undefined ? { relations: node.relations } : {}),
    ...(node.motion !== undefined ? { motion: node.motion } : {}),
    childCount: node.childCount,
    opaque: isOpaque(node),
  }));
  const opaqueNodeCount = snapshots.filter((node) => node.opaque).length;
  const opaqueRegions = opaqueNodeCount + (source === "unavailable" ? 1 : 0);
  const inspectableNodes = snapshots.length - opaqueNodeCount;
  const denominator = inspectableNodes + opaqueRegions;
  const hasStructuralPaths = (nodes ?? []).some(
    (node) => node.path !== undefined || node.parentPath !== undefined || node.depth !== undefined,
  );
  const roots = hasStructuralPaths
    ? snapshots
        .filter((node) => node.parentPath === undefined || node.depth === 0)
        .map((node) => node.path)
    : snapshots[0]
      ? [snapshots[0].path]
      : [];
  return {
    schemaVersion: INSPECT_TREE_SCHEMA_VERSION,
    source,
    roots,
    coverage: {
      totalNodes: snapshots.length,
      inspectableNodes,
      opaqueRegions,
      inspectableNodeRatio: denominator === 0 ? 1 : inspectableNodes / denominator,
    },
    nodes: snapshots,
  };
}

function referenceId(value: string): string {
  const trimmed = value.trim();
  const urlMatch = /^url\(\s*['"]?#([^'"\s)]+)['"]?\s*\)$/.exec(trimmed);
  if (urlMatch?.[1]) return urlMatch[1];
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

function relationIds(node: SemanticTreeNode): string[] {
  const values = [
    node.relations?.mask,
    node.relations?.clip,
    node.relations?.filter,
    ...(node.relations?.references ?? []),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return [...new Set(values.map(referenceId).filter(Boolean))];
}

function geometryBox(node: SemanticTreeNode): SemanticBounds | undefined {
  return node.namespace === "svg" ? node.bounds : node.layout;
}

function hasZeroGeometry(node: SemanticTreeNode, box: SemanticBounds): boolean {
  if (node.namespace === "svg") {
    // A horizontal or vertical path has zero extent on one axis but is visible.
    return box.width < 1 && box.height < 1;
  }
  return box.width < 1 || box.height < 1;
}

function paintsOwnBox(node: SemanticTreeNode): boolean {
  // A painted Frame/Stack is itself artwork, even with no child content.
  const fill = node.paint?.fill?.trim().toLowerCase();
  return !!fill && fill !== "none" && fill !== "transparent";
}

export function scanTreeLayoutIssues(
  nodes: readonly SemanticTreeNode[],
  loc: { frame: number; progress: number },
): TreeCheckIssue[] {
  const semanticNodes = nodes as SemanticTreeNode[];
  const issues: TreeCheckIssue[] = [];
  const siblings = semanticNodes.filter((node) => node.id);
  for (const [index, node] of semanticNodes.entries()) {
    const box = geometryBox(node);
    if (box && !SKIP_ZERO.has(node.tag) && hasZeroGeometry(node, box)) {
      issues.push({
        severity: "error",
        code: "ZERO_BOX",
        message: `${node.id ? `#${node.id}` : node.tag} is ${Math.round(box.width)}×${Math.round(box.height)}`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: `Give an explicit size or width: "fill". Reproduce: ${inspectAt(loc.progress)}`,
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: nodePath(node, index),
        details: {
          geometry: node.namespace === "svg" ? "vector-bounds" : "layout-box",
          estimated: box.estimated === true,
        },
      });
    }
    if (node.metricsExact === false) {
      issues.push({
        severity: "warning",
        code: "TEXT_METRICS_APPROXIMATE",
        message: `Text used approximate metrics for ${node.fontFamily ?? "the requested family"}`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: "Load the font face used by this Text so layout matches paint",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: nodePath(node, index),
        ...(node.fontFamily !== undefined ? { details: { fontFamily: node.fontFamily } } : {}),
      });
    }
    if (node.id && CONTAINERS.has(node.tag) && node.childCount === 0 && !paintsOwnBox(node)) {
      const row = siblings
        .filter((sibling) => sibling.tag === node.tag || CONTAINERS.has(sibling.tag))
        .map((sibling) => `    ${sibling.id}  ${sibling.childCount}`)
        .join("\n");
      issues.push({
        severity: "error",
        code: "EMPTY_CONTAINER",
        message: `#${node.id} has 0 visible children`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: row
          ? `Sibling counts:\n${row}\nReproduce: ${inspectAt(loc.progress)}`
          : `Reproduce: ${inspectAt(loc.progress)}`,
        nodeId: node.id,
        nodePath: nodePath(node, index),
      });
    }
  }
  const byPath = new Map(nodes.filter(n => n.path).map(n => [n.path!, n]));
  const text = nodes.filter(n => n.textGeometry && !n.spatial?.hidden);
  const rectIntersection = (a: SemanticBounds, b: SemanticBounds): boolean =>
    a.x < b.x + b.width - 0.01 && a.x + a.width > b.x + 0.01 && a.y < b.y + b.height - 0.01 && a.y + a.height > b.y + 0.01;
  for (const node of text) {
    const geometry = node.textGeometry!;
    if (!geometry.supported) {
      issues.push({ severity: "warning", code: "TEXT_GEOMETRY_UNVERIFIED", message: "Text geometry has an unsupported transform or ancestor", frame: loc.frame, progress: loc.progress, ...(node.id ? { nodeId: node.id } : {}), ...(node.path ? { nodePath: node.path } : {}) });
      continue;
    }
    const parent = geometry.parentContent;
    const escaping = geometry.lines.filter(({ bounds: b }) => b.x < parent.x - 0.01 || b.y < parent.y - 0.01 || b.x + b.width > parent.x + parent.width + 0.01 || b.y + b.height > parent.y + parent.height + 0.01);
    if (escaping.length) {
      const parentNode = node.parentPath ? byPath.get(node.parentPath) : undefined;
      const explicit = escaping.some(({ bounds: b }) => geometry.constraints.width && (b.x < parent.x - 0.01 || b.x + b.width > parent.x + parent.width + 0.01) || geometry.constraints.height && (b.y < parent.y - 0.01 || b.y + b.height > parent.y + parent.height + 0.01));
      issues.push({ severity: geometry.metrics === "font" && explicit && !geometry.clipped && !geometry.transient ? "error" : "warning", code: "TEXT_OUTSIDE_PARENT", message: "Text line boxes extend beyond their parent content constraint", frame: loc.frame, progress: loc.progress, ...(node.id ? { nodeId: node.id } : {}), ...(node.path ? { nodePath: node.path } : {}), ...(parentNode?.id ? { relatedIds: [parentNode.id] } : {}), suggestion: "Allow the parent to grow or allocate enough space for the measured lines.", details: { parent, lines: escaping.map(line => line.bounds), constraints: geometry.constraints, metrics: geometry.metrics, clipped: geometry.clipped, transient: geometry.transient } });
    }
  }
  // Compare distinct flow items only; Frame children are deliberately layered.
  const groups = new Map<string, typeof text>();
  for (const node of text) for (const scope of node.textGeometry!.flow) {
    const group = groups.get(scope.stack) ?? []; group.push(node); groups.set(scope.stack, group);
  }
  const seen = new Set<string>();
  for (const [stack, group] of groups) {
    group.sort((a, b) => a.textGeometry!.content.y - b.textGeometry!.content.y);
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i]!, b = group[j]!, ga = a.textGeometry!, gb = b.textGeometry!;
      if (gb.content.y >= ga.content.y + ga.content.height) break;
      if (!ga.supported || !gb.supported || ga.flow.find(s => s.stack === stack)?.item === gb.flow.find(s => s.stack === stack)?.item) continue;
      const key = [a.path, b.path].sort().join("|"); if (seen.has(key)) continue;
      const visible = (r: SemanticBounds, n: SemanticTreeNode): SemanticBounds => {
        const c = n.spatial?.clip; if (!c) return r;
        const x = Math.max(r.x, c.x), y = Math.max(r.y, c.y);
        return { x, y, width: Math.max(0, Math.min(r.x + r.width, c.x + c.width) - x), height: Math.max(0, Math.min(r.y + r.height, c.y + c.height) - y) };
      };
      const pair = ga.lines.flatMap(x => gb.lines.map(y => [visible(x.bounds, a), visible(y.bounds, b)] as const)).find(([x, y]) => x.width > 0 && x.height > 0 && y.width > 0 && y.height > 0 && rectIntersection(x, y));
      if (!pair) continue;
      seen.add(key);
      issues.push({ severity: ga.metrics === "font" && gb.metrics === "font" && !ga.transient && !gb.transient ? "error" : "warning", code: "FLOW_TEXT_LINE_OVERLAP", message: "Text line boxes overlap across flow items; glyph occlusion is not established", frame: loc.frame, progress: loc.progress, ...(a.id ? { nodeId: a.id } : {}), ...(a.path ? { nodePath: a.path } : {}), relatedIds: [a.id, b.id].filter((id): id is string => !!id), details: { stack, lines: pair, metrics: [ga.metrics, gb.metrics], transient: ga.transient || gb.transient } });
    }
  }
  return issues;
}

export function scanTreeSemanticIssues(
  nodes: readonly SemanticTreeNode[],
  loc: { frame: number; progress: number },
): TreeCheckIssue[] {
  const issues: TreeCheckIssue[] = [];
  const ids = new Map<string, Array<{ node: SemanticTreeNode; index: number }>>();
  const byPath = new Map<string, SemanticTreeNode>();

  for (const [index, node] of nodes.entries()) {
    if (node.id) {
      const entries = ids.get(node.id) ?? [];
      entries.push({ node, index });
      ids.set(node.id, entries);
    }
    if (node.path) byPath.set(node.path, node);
  }

  for (const [id, entries] of ids) {
    if (entries.length < 2) continue;
    const paths = entries.map(({ node, index }) => nodePath(node, index));
    issues.push({
      severity: "error",
      code: "DUPLICATE_NODE_ID",
      message: `#${id} is used by ${entries.length} nodes`,
      frame: loc.frame,
      progress: loc.progress,
      suggestion: "Give every inspectable node a unique, stable id.",
      nodeId: id,
      ...(paths[0] === undefined ? {} : { nodePath: paths[0] }),
      relatedIds: [id],
      details: { paths, occurrences: entries.length },
    });
  }

  const declaredIds = new Set(ids.keys());
  for (const [index, node] of nodes.entries()) {
    const path = nodePath(node, index);
    const references = relationIds(node);
    for (const reference of references) {
      if (declaredIds.has(reference)) continue;
      issues.push({
        severity: "error",
        code: "UNRESOLVED_NODE_REF",
        message: `${node.id ? `#${node.id}` : node.tag} references missing #${reference}`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: "Add the referenced definition or correct the mask/clip id.",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: path,
        relatedIds: [reference],
        details: { reference },
      });
    }

    const isPath = PATH_TAGS.has(node.tag) || node.geometry?.kind === "path";
    const emptyPath = isPath && node.geometry?.d !== undefined && node.geometry.d.trim() === "";
    if (isPath && (node.geometry?.valid === false || emptyPath)) {
      issues.push({
        severity: "error",
        code: "INVALID_PATH_DATA",
        message: `${node.id ? `#${node.id}` : node.tag} has invalid path data${node.geometry?.error ? `: ${node.geometry.error}` : ""}`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: "Provide finite SVG path commands and inspect the path bounds.",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: path,
        details: {
          ...(node.geometry?.error !== undefined ? { error: node.geometry.error } : {}),
          ...(node.geometry?.d !== undefined ? { d: node.geometry.d } : {}),
        },
      });
    }

    const wrongNamespace =
      (node.namespace === "html" && SVG_TAGS.has(node.tag)) ||
      (node.namespace === "svg" && node.tag !== "Html" && HTML_ONLY_TAGS.has(node.tag));
    if (wrongNamespace) {
      issues.push({
        severity: "error",
        code: "NAMESPACE_MISMATCH",
        message: `${node.tag} cannot be lowered in the ${node.namespace} namespace`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion:
          node.namespace === "html"
            ? "Place vector nodes inside Vector()."
            : "Move HTML/layout content outside Vector() or use an explicit foreignObject boundary.",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: path,
        details: { namespace: node.namespace, tag: node.tag },
      });
    }

    if (TEXT_RUN_TAGS.has(node.tag)) {
      const parent = node.parentPath ? byPath.get(node.parentPath) : undefined;
      if (!parent || !VECTOR_TEXT_TAGS.has(parent.tag)) {
        issues.push({
          severity: "error",
          code: "TEXT_RUN_OUTSIDE_TEXT",
          message: `${node.tag} must be a direct child of vector text`,
          frame: loc.frame,
          progress: loc.progress,
          suggestion: "Wrap the run in vector.text().",
          ...(node.id !== undefined ? { nodeId: node.id } : {}),
          nodePath: path,
          details: {
            ...(node.parentPath !== undefined ? { parentPath: node.parentPath } : {}),
            ...(parent !== undefined ? { parentTag: parent.tag } : {}),
          },
        });
      }
    }

    if ((MASK_TAGS.has(node.tag) || CLIP_TAGS.has(node.tag)) && node.childCount === 0) {
      issues.push({
        severity: "error",
        code: "EMPTY_CLIP_OR_MASK",
        message: `${node.id ? `#${node.id}` : node.tag} has no geometry`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: "Add at least one vector shape to the definition.",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: path,
        details: { definition: MASK_TAGS.has(node.tag) ? "mask" : "clip" },
      });
    }

    if (isOpaque(node)) {
      issues.push({
        severity: "warning",
        code: "OPAQUE_REGION",
        message: `${node.id ? `#${node.id}` : node.tag} is an opaque markup region`,
        frame: loc.frame,
        progress: loc.progress,
        suggestion: "Use media/vector nodes where inspectable geometry and relationships matter.",
        ...(node.id !== undefined ? { nodeId: node.id } : {}),
        nodePath: path,
        details: { tag: node.tag },
      });
    }
  }

  return issues;
}

export function missingTreeIssue(loc: {
  frame: number;
  progress: number;
}): TreeCheckIssue {
  return {
    severity: "warning",
    code: "OPAQUE_REGION",
    message: "This sample has no media-tree capture, so semantic inspection is unavailable",
    frame: loc.frame,
    progress: loc.progress,
    suggestion: "Rebuild the render stack and ensure render() returns a MediaElement tree.",
    nodePath: "/",
    details: { source: "unavailable" },
  };
}
