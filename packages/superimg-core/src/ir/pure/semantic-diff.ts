//! Content set-diff for inspect samples.

export interface InspectDiff {
  from: number;
  to: number;
  addedText: string[];
  removedText: string[];
  addedColors: string[];
  removedColors: string[];
  addedEqKeys: string[];
  removedEqKeys: string[];
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: Array<{
    id: string;
    fields: Array<"layout" | "bounds" | "geometry" | "paint" | "relations">;
  }>;
  boxDeltas: Array<{
    id: string;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    fromLayout: { x: number; y: number; width: number; height: number };
    toLayout: { x: number; y: number; width: number; height: number };
  }>;
}

interface InspectSemanticNode {
  id?: string;
  path?: string;
  tag: string;
  layout?: { x: number; y: number; width: number; height: number };
  bounds?: { x: number; y: number; width: number; height: number };
  geometry?: unknown;
  paint?: unknown;
  relations?: unknown;
}

function nodeKey(node: InspectSemanticNode, index: number): string {
  return node.id ?? node.path ?? `${node.tag}@${index}`;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setDiff(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const added = b.filter((x) => !aSet.has(x));
  const removed = a.filter((x) => !bSet.has(x));
  // unique preserve order
  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
}

export function diffSemantics(
  from: number,
  to: number,
  a: {
    text: string[];
    colors: string[];
    eqKeys: string[];
    nodes?: InspectSemanticNode[];
  },
  b: {
    text: string[];
    colors: string[];
    eqKeys: string[];
    nodes?: InspectSemanticNode[];
  },
): InspectDiff {
  const text = setDiff(a.text, b.text);
  const colors = setDiff(a.colors, b.colors);
  const eqKeys = setDiff(a.eqKeys, b.eqKeys);
  const aKeys = (a.nodes ?? []).map(nodeKey);
  const bKeys = (b.nodes ?? []).map(nodeKey);
  const nodes = setDiff(aKeys, bKeys);
  const aById = new Map((a.nodes ?? []).map((node, index) => [nodeKey(node, index), node]));
  const boxDeltas: InspectDiff["boxDeltas"] = [];
  const changedNodes: InspectDiff["changedNodes"] = [];
  for (const [index, n] of (b.nodes ?? []).entries()) {
    const id = nodeKey(n, index);
    const prev = aById.get(id);
    if (!prev) continue;
    const fields: InspectDiff["changedNodes"][number]["fields"] = [];
    for (const field of ["layout", "bounds", "geometry", "paint", "relations"] as const) {
      if (!sameValue(prev[field], n[field])) fields.push(field);
    }
    if (fields.length > 0) changedNodes.push({ id, fields });

    const fromBox = prev.bounds ?? prev.layout;
    const toBox = n.bounds ?? n.layout;
    if (!fromBox || !toBox) continue;
    const dx = toBox.x - fromBox.x;
    const dy = toBox.y - fromBox.y;
    const dw = toBox.width - fromBox.width;
    const dh = toBox.height - fromBox.height;
    if (dx || dy || dw || dh) {
      boxDeltas.push({
        id,
        dx,
        dy,
        dw,
        dh,
        fromLayout: { ...fromBox },
        toLayout: { ...toBox },
      });
    }
  }
  return {
    from,
    to,
    addedText: text.added,
    removedText: text.removed,
    addedColors: colors.added,
    removedColors: colors.removed,
    addedEqKeys: eqKeys.added,
    removedEqKeys: eqKeys.removed,
    addedNodes: nodes.added,
    removedNodes: nodes.removed,
    changedNodes,
    boxDeltas,
  };
}
