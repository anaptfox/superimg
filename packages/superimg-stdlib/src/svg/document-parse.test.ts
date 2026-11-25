import { describe, expect, it } from "vitest";
import { parseSvgTree } from "./document-parse.js";
import { editSvgTree, type SvgTreeElement } from "./document-tree.js";
import { serializeSvgTree } from "./document-serialize.js";

const bytes = (source: string) => new TextEncoder().encode(source);
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

describe("SVG document parser", () => {
  it("parses namespaced elements, decoded text and independently editable IDs", () => {
    const original = parseSvgTree(bytes(svg('<text id="label">tea &amp; cake</text><rect id="body" fill="red"/>')));
    expect((original.children[0] as SvgTreeElement).children.join("")).toBe("tea & cake");
    const edited = editSvgTree(original, { body: { fill: "#abc" } });
    expect((edited.children[1] as SvgTreeElement).attributes.fill).toBe("#abc");
    expect((original.children[1] as SvgTreeElement).attributes.fill).toBe("red");
  });
  it("refuses malformed, non-SVG, executable and duplicate-ID input", () => {
    for (const input of ['<svg>', '<svg xmlns="http://www.w3.org/1999/xhtml"/>', svg('<script/>'), svg('<rect onclick="x"/>'), svg('<rect id="a"/><rect id="a"/>'), '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>']) {
      expect(() => parseSvgTree(bytes(input))).toThrow();
    }
  });
  it("validates local references and rejects unsupported external or CSS resources", () => {
    expect(() => parseSvgTree(bytes(svg('<defs><linearGradient id="paint"/></defs><rect fill="url(#paint)"/><use href="#paint"/>')))).not.toThrow();
    for (const body of ['<rect fill="url(#missing)"/>', '<use href="https://example.test/art.svg#x"/>', '<rect fill="url(https://example.test/a)"/>', '<rect style="fill:red"/>']) {
      expect(() => parseSvgTree(bytes(svg(body)))).toThrow();
    }
  });
  it("refuses embedded HTML and embedded font CSS with a feature-specific error", () => {
    expect(() => parseSvgTree(bytes(svg('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">Hello</div></foreignObject>')))).toThrow(/foreignObject/);
    expect(() => parseSvgTree(bytes(svg('<style>@font-face { font-family: Custom; src: url(font.woff2) }</style>')))).toThrow(/style/);
  });
  it("rejects rebased local references and incorrectly bound xlink prefixes", () => {
    const body = '<defs><path id="shape" d="M0 0L1 1"/></defs>';
    expect(() => parseSvgTree(bytes(svg(`${body}<use xml:base="https://example.test/art.svg" href="#shape"/>`)))).toThrow(/xml:base/);
    const invalid = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="https://example.test/not-xlink">${body}<use xlink:href="#shape"/></svg>`;
    expect(() => parseSvgTree(bytes(invalid))).toThrow(/xlink namespace/);
    const valid = invalid.replace("https://example.test/not-xlink", "http://www.w3.org/1999/xlink");
    expect(() => parseSvgTree(bytes(valid))).not.toThrow();
  });
  it("serializes edited artwork as SVG and preserves escaped text and references", () => {
    const source = svg('<defs><linearGradient id="paint"/></defs><text id="label">tea &amp; cake</text><rect id="body" fill="url(#paint)"/>');
    const original = parseSvgTree(bytes(source));
    const edited = editSvgTree(original, { body: { fill: "#abc" } });
    const output = serializeSvgTree(edited);
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain("tea &amp; cake");
    expect((parseSvgTree(bytes(output)).children[2] as SvgTreeElement).attributes.fill).toBe("#abc");
    expect(serializeSvgTree(original)).toContain("url(#paint)");
  });
  it("rejects an incompatible default namespace even on an SVG-prefixed child", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:g xmlns="http://www.w3.org/1999/xhtml"/></svg>';
    expect(() => parseSvgTree(bytes(source))).toThrow(/default namespace/);
  });
});
