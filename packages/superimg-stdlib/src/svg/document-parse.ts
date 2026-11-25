//! Parse SVG into the immutable document tree. Unsupported document features
//! are rejected explicitly; this module does not fetch external resources.
import { SaxesParser } from "saxes";
import { snapshotSvgTree, type SvgTreeChild, type SvgTreeElement } from "./document-tree.js";
import { validateSvgReferences } from "./document-references.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const refused = new Set(["script", "foreignObject", "animate", "animateMotion", "animateTransform", "set", "style"]);

/** Parse an SVG document from caller-owned bytes without retaining them. */
export function parseSvgTree(bytes: Uint8Array): SvgTreeElement {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parser = new SaxesParser({ xmlns: true });
  type MutableElement = { name: string; attributes: Record<string, string>; children: SvgTreeChild[] };
  const stack: MutableElement[] = [];
  let root: SvgTreeElement | undefined;
  parser.on("doctype", () => { throw new TypeError("SVG doctype is unsupported"); });
  parser.on("opentag", tag => {
    if (tag.uri !== SVG_NAMESPACE) throw new TypeError(`Unsupported SVG element namespace: ${tag.uri}`);
    if (refused.has(tag.local)) throw new TypeError(`Unsupported SVG element: ${tag.local}`);
    const attributes: Record<string, string> = Object.create(null);
    for (const attribute of Object.values(tag.attributes)) {
      if (/^on/i.test(attribute.local)) throw new TypeError(`Unsupported SVG event attribute: ${attribute.name}`);
      if (attribute.name === "xmlns" && attribute.value !== SVG_NAMESPACE) throw new TypeError(`Unsupported default namespace: ${attribute.value}`);
      // A local-looking fragment can resolve against xml:base to another
      // document, bypassing the local resource boundary. Qualified references
      // must also really belong to the namespaces their spelling implies.
      if (attribute.uri === XML_NAMESPACE && attribute.local === "base") throw new TypeError("SVG xml:base is unsupported");
      if (attribute.name === "xlink:href" && attribute.uri !== XLINK_NAMESPACE) throw new TypeError("Invalid SVG xlink namespace");
      attributes[attribute.name] = attribute.value;
    }
    const element: MutableElement = { name: tag.local, attributes, children: [] };
    if (stack.length > 0) stack[stack.length - 1]!.children.push(element);
    else root = element;
    stack.push(element);
  });
  const addText = (text: string) => { if (stack.length > 0) stack[stack.length - 1]!.children.push(text); };
  parser.on("text", addText);
  parser.on("cdata", addText);
  parser.on("closetag", () => { stack.pop(); });
  parser.write(source).close();
  if (!root || root.name !== "svg") throw new TypeError("SVG root element is required");
  const result = snapshotSvgTree(root);
  validateSvgReferences(result);
  return result;
}
