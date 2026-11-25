//! Pure immutable SVG document tree and bounded named paint edits.
//! Parsing, reference validation and serialization remain separate owners.
import { bounds as pathBounds } from "./bezier.js";
import { parsePath } from "path-data-parser";
import { isNamedSvgColor } from "./css-color-keywords.js";

export interface SvgTreeElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly SvgTreeChild[];
}
export type SvgTreeChild = SvgTreeElement | string;
export type SvgPaintEdit = Readonly<{ fill?: string; stroke?: string; text?: string; opacity?: number; x?: number; y?: number; cx?: number; cy?: number; rx?: number; ry?: number; r?: number; width?: number; height?: number; stdDeviation?: number; d?: string; transform?: Readonly<{ x: number; y: number }> }>;
const numericGeometry = new Set(["x", "y", "cx", "cy", "rx", "ry", "r", "width", "height", "stdDeviation"]);
const nonnegativeGeometry = new Set(["rx", "ry", "r", "width", "height", "stdDeviation"]);
const geometryByElement: Readonly<Record<string, readonly string[]>> = {
  rect: ["x", "y", "width", "height", "rx", "ry"], circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"],
  text: ["x", "y"], tspan: ["x", "y"], use: ["x", "y", "width", "height"],
  feGaussianBlur: ["stdDeviation"],
};

function copyElement(element: SvgTreeElement): SvgTreeElement {
  return Object.freeze({
    name: element.name,
    attributes: Object.freeze({ ...element.attributes }),
    children: Object.freeze(element.children.map(child => typeof child === "string" ? child : copyElement(child))),
  });
}

function indexIds(root: SvgTreeElement): Map<string, SvgTreeElement> {
  const ids = new Map<string, SvgTreeElement>();
  function visit(element: SvgTreeElement): void {
    const id = element.attributes.id;
    if (id !== undefined) {
      if (ids.has(id)) throw new TypeError(`Duplicate SVG id: ${id}`);
      ids.set(id, element);
    }
    for (const child of element.children) if (typeof child !== "string") visit(child);
  }
  visit(root);
  return ids;
}

/** Copy a parsed tree so callers cannot mutate the accepted source. */
export function snapshotSvgTree(root: SvgTreeElement): SvgTreeElement {
  const snapshot = copyElement(root);
  indexIds(snapshot);
  return snapshot;
}

/** Apply literal paint edits to uniquely named elements without modifying the source. */
export function editSvgTree(root: SvgTreeElement, edits: Readonly<Record<string, SvgPaintEdit>>): SvgTreeElement {
  const ids = indexIds(root);
  for (const [id, edit] of Object.entries(edits)) {
    if (!ids.has(id)) throw new TypeError(`Unknown SVG id: ${id}`);
    const element = ids.get(id)!;
    for (const [key, value] of Object.entries(edit)) {
      if (key === "opacity") {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`Invalid opacity for ${id}`);
      } else if (key === "fill" || key === "stroke") {
        if (typeof value !== "string") throw new TypeError(`Invalid ${key} for ${id}`);
        const reference = /^url\(#([^\s#()'"\\]+)\)$/.exec(value);
        if (reference) {
          const target = ids.get(reference[1]!);
          if (!target) throw new TypeError(`Unresolved SVG reference: #${reference[1]}`);
          if (!["linearGradient", "radialGradient", "pattern"].includes(target.name)) throw new TypeError(`Unsupported SVG paint reference: #${reference[1]}`);
        } else if (!/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|none|transparent)$/i.test(value) && !isNamedSvgColor(value)) throw new TypeError(`Invalid literal ${key} for ${id}`);
      } else if (key === "text") {
        if (!["text", "tspan"].includes(element.name) || element.children.some(child => typeof child !== "string")) throw new TypeError(`Unsupported text edit on ${element.name}`);
        if (typeof value !== "string" || [...value].some(char => { const cp = char.codePointAt(0)!; return !(cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff)); })) throw new TypeError(`Invalid text for ${id}`);
      } else if (numericGeometry.has(key)) {
        if (!geometryByElement[element.name]?.includes(key)) throw new TypeError(`Unsupported ${key} on ${element.name}`);
        if (typeof value !== "number" || !Number.isFinite(value) || (nonnegativeGeometry.has(key) && value < 0)) throw new TypeError(`Invalid ${key} for ${id}`);
      } else if (key === "d") {
        if (element.name !== "path") throw new TypeError(`Unsupported path data on ${element.name}`);
        if (typeof value !== "string" || !/^\s*[Mm]/.test(value)) throw new TypeError(`Invalid path for ${id}`);
        try {
          const commands = parsePath(value);
          if (commands.some(command => command.data.some(number => !Number.isFinite(number)) || (command.key.toUpperCase() === "A" && (command.data[0]! < 0 || command.data[1]! < 0 || ![0, 1].includes(command.data[3]!) || ![0, 1].includes(command.data[4]!))))) throw new Error("Invalid path command");
          const bounds = pathBounds(value);
          if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error("Non-finite path bounds");
        } catch { throw new TypeError(`Invalid path for ${id}`); }
      } else if (key === "transform") {
        if (!value || typeof value !== "object" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Object.keys(value).some(part => part !== "x" && part !== "y")) throw new TypeError(`Invalid transform for ${id}`);
      } else throw new TypeError(`Unsupported SVG edit: ${key}`);
    }
  }
  function visit(element: SvgTreeElement): SvgTreeElement {
    const edit = element.attributes.id === undefined ? undefined : edits[element.attributes.id];
    const attributes = { ...element.attributes };
    if (edit?.fill !== undefined) attributes.fill = edit.fill;
    if (edit?.stroke !== undefined) attributes.stroke = edit.stroke;
    if (edit?.opacity !== undefined) attributes.opacity = String(edit.opacity);
    if (edit?.transform !== undefined) attributes.transform = `translate(${edit.transform.x} ${edit.transform.y})`;
    if (edit) for (const [key, value] of Object.entries(edit)) {
      if (numericGeometry.has(key) || key === "d") attributes[key] = String(value);
    }
    const children = edit?.text === undefined ? element.children.map(child => typeof child === "string" ? child : visit(child)) : [edit.text];
    return Object.freeze({ name: element.name, attributes: Object.freeze(attributes), children: Object.freeze(children) });
  }
  return visit(root);
}

/** Keep a named painted subtree, its ancestors, and definitions required for references. */
export function selectSvgPart(root: SvgTreeElement, id: string): SvgTreeElement {
  let found = false;
  function prune(element: SvgTreeElement, inDefs: boolean): SvgTreeElement | undefined {
    if (element.attributes.id === id) {
      if (inDefs || element.name === "defs") throw new TypeError(`SVG part is not painted: ${id}`);
      found = true;
      return element;
    }
    if (element.name === "defs") return element;
    const children = element.children.flatMap(child => {
      if (typeof child === "string") return [];
      const kept = prune(child, inDefs || element.name === "defs");
      return kept ? [kept] : [];
    });
    return children.length ? Object.freeze({ ...element, children: Object.freeze(children) }) : undefined;
  }
  const result = prune(root, false);
  if (!found || !result) throw new TypeError(`Unknown SVG part: ${id}`);
  return result;
}
