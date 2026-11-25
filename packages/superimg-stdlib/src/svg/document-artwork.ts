//! Realize validated SVG documents through the existing Vector tree.
import { h } from "../tree/h.js";
import { Vector, type VectorAspectRatio } from "../tree/vector.js";
import type { MediaChild, MediaNode } from "../tree/node-types.js";
import { parseSvgTree } from "./document-parse.js";
import { editSvgTree, selectSvgPart, type SvgPaintEdit, type SvgTreeElement } from "./document-tree.js";
import { serializeSvgTree } from "./document-serialize.js";
import { validateSvgReferences } from "./document-references.js";
import type { VisualPart } from "../scene-types.js";

const supported = new Set(["g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "linearGradient", "radialGradient", "stop", "pattern", "filter", "feGaussianBlur", "feMerge", "feMergeNode", "feTurbulence", "feDisplacementMap", "mask", "clipPath", "text", "tspan", "use", "title", "desc"]);
// These names are consumed as tree-node props rather than emitted as SVG
// attributes. Reject them until a native realization can preserve them.
const reservedAttributes = new Set(["key", "children", "html", "motion", "semantic", "fit", "mode", "family", "size", "weight", "anchor", "styleName"]);

export interface SvgDocument {
  readonly tree: SvgTreeElement;
  /** A fresh copy of the exact original bytes, independent of edits. */
  readonly source: Uint8Array;
}

export function svgDocument(bytes: Uint8Array): SvgDocument {
  const source = new Uint8Array(bytes);
  const tree = parseSvgTree(source);
  return Object.freeze({ tree, get source() { return new Uint8Array(source); } });
}

/** Identity of the accepted original bytes and of one canonical edited tree. */
export async function svgDocumentIdentity(document: SvgDocument, edits: Readonly<Record<string, SvgPaintEdit>> = {}): Promise<Readonly<{ sourceSha256: string; revisionSha256: string }>> {
  async function digest(bytes: Uint8Array): Promise<string> {
    const owned = new Uint8Array(bytes);
    const hash = await globalThis.crypto.subtle.digest("SHA-256", owned.buffer);
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
  }
  const revision = serializeSvgTree(editSvgTree(document.tree, edits));
  const [sourceSha256, revisionSha256] = await Promise.all([digest(document.source), digest(new TextEncoder().encode(revision))]);
  return Object.freeze({ sourceSha256, revisionSha256 });
}

function viewBox(root: SvgTreeElement): { x: number; y: number; width: number; height: number } {
  const values = root.attributes.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (!values || values.length !== 4 || values.some(value => !Number.isFinite(value)) || values[2]! <= 0 || values[3]! <= 0) throw new TypeError("SVG artwork requires a finite positive viewBox");
  return { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
}

export function SvgArtwork(options: Readonly<{ document: SvgDocument; width: number; height: number; id?: string; only?: string; edits?: Readonly<Record<string, SvgPaintEdit>> }>): MediaNode {
  const edited = options.edits ? editSvgTree(options.document.tree, options.edits) : options.document.tree;
  const root = options.only ? selectSvgPart(edited, options.only) : edited;
  if (options.only) validateSvgReferences(root);
  for (const name of Object.keys(root.attributes)) {
    if (!["xmlns", "viewBox", "width", "height", "version", "preserveAspectRatio"].includes(name) && !name.startsWith("xmlns:")) {
      throw new TypeError(`Unsupported SVG root attribute: ${name}`);
    }
  }
  const box = viewBox(root);
  const aspect = root.attributes.preserveAspectRatio?.trim().replace(/\s+/g, " ");
  if (aspect !== undefined && !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(aspect)) {
    throw new TypeError(`Unsupported SVG preserveAspectRatio: ${aspect}`);
  }
  const ids = new Map<string, string>();
  function collect(element: SvgTreeElement): void {
    const id = element.attributes.id;
    if (id !== undefined) {
      if (!options.id) throw new TypeError("SVG artwork containing IDs requires an occurrence id");
      ids.set(id, `si_art_${[...options.id].map(c => c.codePointAt(0)!.toString(16)).join("_")}_${id}`);
    }
    for (const child of element.children) if (typeof child !== "string") collect(child);
  }
  collect(root);
  function scoped(attributes: Readonly<Record<string, string>>): Record<string, string> {
    if (attributes.href !== undefined && attributes["xlink:href"] !== undefined) throw new TypeError("SVG artwork cannot combine href and xlink:href on one element");
    return Object.fromEntries(Object.entries(attributes).map(([key, value]) => {
      if (key === "id") return [key, ids.get(value) ?? value];
      if ((key === "href" || key === "xlink:href") && value.startsWith("#")) return ["href", `#${ids.get(value.slice(1)) ?? value.slice(1)}`];
      if (key === "aria-labelledby" || key === "aria-describedby") return [key, value.trim().split(/\s+/).map(id => ids.get(id) ?? id).join(" ")];
      return [key, value.replace(/url\(\s*(['"]?)#([^\s)'"\\]+)\1\s*\)/gi, (_match, quote: string, id: string) => `url(${quote}#${ids.get(id) ?? id}${quote})`)];
    }));
  }
  function realize(element: SvgTreeElement): MediaNode {
    if (!supported.has(element.name)) throw new TypeError(`Unsupported SVG artwork element: ${element.name}`);
    for (const key of Object.keys(element.attributes)) {
      if (reservedAttributes.has(key) || (key.includes(":") && key !== "xlink:href" && !key.startsWith("xml:") && !key.startsWith("xmlns:"))) throw new TypeError(`Unsupported SVG artwork attribute ${key} on ${element.name}`);
    }
    const children: MediaChild[] = element.children.map(child => typeof child === "string" ? child : realize(child));
    return h(element.name, scoped(element.attributes), ...children);
  }
  const children: MediaChild[] = root.children.map(child => typeof child === "string" ? child : realize(child));
  return Vector({ width: options.width, height: options.height, viewBox: box, ...(aspect === undefined ? {} : { preserveAspectRatio: aspect as VectorAspectRatio }) }, ...children);
}

/** Build a Scene part in the document's original local coordinate system. */
export function svgPart(id: string, options: Readonly<{ document: SvgDocument; only?: string; edits?: Readonly<Record<string, SvgPaintEdit>>; band?: number; order?: number }>): VisualPart {
  const bounds = viewBox(options.document.tree);
  return { id, bounds, ...(options.band === undefined ? {} : { band: options.band }), ...(options.order === undefined ? {} : { order: options.order }), content: SvgArtwork({ document: options.document, id, width: bounds.width, height: bounds.height, ...(options.only === undefined ? {} : { only: options.only }), ...(options.edits === undefined ? {} : { edits: options.edits }) }) };
}
