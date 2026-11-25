//! Deterministic XML serialization for the parsed SVG document tree.
import type { SvgTreeElement } from "./document-tree.js";
import { validateSvgReferences } from "./document-references.js";

function text(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function attribute(value: string): string {
  return text(value).replace(/"/g, "&quot;").replace(/\r/g, "&#13;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;");
}

/** Serialize a validated tree with a canonical SVG default namespace. */
export function serializeSvgTree(root: SvgTreeElement): string {
  if (root.name !== "svg") throw new TypeError("SVG root element is required");
  validateSvgReferences(root);
  function write(element: SvgTreeElement, isRoot: boolean): string {
    const attributes = isRoot ? { ...element.attributes, xmlns: "http://www.w3.org/2000/svg" } : element.attributes;
    const serializedAttributes = Object.keys(attributes).sort().map(name => ` ${name}="${attribute(attributes[name]!)}"`).join("");
    const children = element.children.map(child => typeof child === "string" ? text(child) : write(child, false)).join("");
    return `<${element.name}${serializedAttributes}>${children}</${element.name}>`;
  }
  return write(root, true);
}
