//! Validation for the explicitly supported local SVG reference syntax.
import type { SvgTreeElement } from "./document-tree.js";

export function validateSvgReferences(root: SvgTreeElement): void {
  const ids = new Set<string>();
  const references: string[] = [];
  const localUrl = /url\(\s*(['"]?)#([^\s)'"\\]+)\1\s*\)/gi;
  function visit(element: SvgTreeElement): void {
    if (element.attributes.id !== undefined) ids.add(element.attributes.id);
    for (const [name, value] of Object.entries(element.attributes)) {
      if (name === "style") throw new TypeError("SVG style attributes are not yet supported");
      if (name === "href" || name === "xlink:href") {
        if (!/^#[^\s#]+$/.test(value)) throw new TypeError(`Unsupported SVG resource reference: ${value}`);
        references.push(value.slice(1));
      }
      if (name === "aria-labelledby" || name === "aria-describedby") {
        references.push(...value.trim().split(/\s+/).filter(Boolean));
      }
      localUrl.lastIndex = 0;
      const remaining = value.replace(localUrl, (_match, _quote: string, id: string) => { references.push(id); return ""; });
      if (/url\s*\(/i.test(remaining)) throw new TypeError(`Unsupported SVG URL reference: ${value}`);
    }
    for (const child of element.children) if (typeof child !== "string") visit(child);
  }
  visit(root);
  for (const id of references) if (!ids.has(id)) throw new TypeError(`Unresolved SVG reference: #${id}`);
}
