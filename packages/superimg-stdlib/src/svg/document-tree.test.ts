import { describe, expect, it } from "vitest";
import { editSvgTree, snapshotSvgTree, type SvgTreeElement } from "./document-tree.js";

const source = (): SvgTreeElement => ({ name: "svg", attributes: {}, children: [{ name: "rect", attributes: { id: "body", fill: "red" }, children: [] }] });

describe("SVG document tree", () => {
  it("copies the input and returns independent frozen edits", () => {
    const input = source();
    const original = snapshotSvgTree(input);
    const blue = editSvgTree(original, { body: { fill: "#123456", opacity: 0.5 } });
    expect((blue.children[0] as SvgTreeElement).attributes).toMatchObject({ fill: "#123456", opacity: "0.5" });
    expect((original.children[0] as SvgTreeElement).attributes.fill).toBe("red");
    expect(Object.isFrozen(blue.children)).toBe(true);
    expect(Object.isFrozen((blue.children[0] as SvgTreeElement).attributes)).toBe(true);
    (input.children[0] as { attributes: Record<string, string> }).attributes.fill = "green";
    expect((original.children[0] as SvgTreeElement).attributes.fill).toBe("red");
  });

  it("refuses duplicate or unknown ids and edits outside the bounded contract", () => {
    const original = snapshotSvgTree(source());
    expect(() => snapshotSvgTree({ ...source(), children: [source().children[0]!, source().children[0]!] })).toThrow(/Duplicate SVG id/);
    expect(() => editSvgTree(original, { missing: { fill: "blue" } })).toThrow(/Unknown SVG id/);
    expect(() => editSvgTree(original, { body: { opacity: NaN } })).toThrow(/Invalid opacity/);
    expect(() => editSvgTree(original, { body: { fill: "url(#gradient)" } })).toThrow(/Unresolved SVG reference/);
    expect(() => editSvgTree(original, { body: { id: "other" } as never })).toThrow(/Unsupported SVG edit/);
  });
  it("edits plain text and permits only existing local paint servers", () => {
    const tree = snapshotSvgTree({ name: "svg", attributes: {}, children: [
      { name: "linearGradient", attributes: { id: "paint" }, children: [] },
      { name: "rect", attributes: { id: "body" }, children: [] },
      { name: "text", attributes: { id: "label" }, children: ["old"] },
      { name: "text", attributes: { id: "nested" }, children: [{ name: "tspan", attributes: {}, children: ["keep"] }] },
    ] });
    const edited = editSvgTree(tree, { body: { fill: "url(#paint)" }, label: { text: "A & <B>" } });
    expect((edited.children[1] as SvgTreeElement).attributes.fill).toBe("url(#paint)");
    expect((edited.children[2] as SvgTreeElement).children).toEqual(["A & <B>"]);
    expect((tree.children[2] as SvgTreeElement).children).toEqual(["old"]);
    expect(() => editSvgTree(tree, { body: { fill: "url(https://example.com/a)" } })).toThrow(/Invalid literal/);
    expect(() => editSvgTree(tree, { body: { fill: "url(#label)" } })).toThrow(/Unsupported SVG paint reference/);
    expect(() => editSvgTree(tree, { body: { text: "no" } })).toThrow(/Unsupported text/);
    expect(() => editSvgTree(tree, { nested: { text: "no" } })).toThrow(/Unsupported text/);
    expect(() => editSvgTree(tree, { label: { text: "bad\u0000" } })).toThrow(/Invalid text/);
  });
  it("accepts fixed CSS color names without accepting host-dependent or executable paint", () => {
    const original = snapshotSvgTree(source());
    for (const color of ["blue", "RebeccaPurple", "lightgoldenrodyellow"]) {
      expect((editSvgTree(original, { body: { fill: color } }).children[0] as SvgTreeElement).attributes.fill).toBe(color);
    }
    for (const color of ["not-a-color", "currentColor", "CanvasText", "blue;stroke:red", "url(https://example.com/a)"]) {
      expect(() => editSvgTree(original, { body: { fill: color } })).toThrow(/Invalid literal/);
    }
    expect((original.children[0] as SvgTreeElement).attributes.fill).toBe("red");
  });
  it("accepts finite geometry and valid paths while refusing invalid values", () => {
    const tree = snapshotSvgTree({ name: "svg", attributes: {}, children: [{ name: "path", attributes: { id: "stream", d: "M0 0L1 1" }, children: [] }, { name: "rect", attributes: { id: "box" }, children: [] }] });
    const edited = editSvgTree(tree, { stream: { d: "M0 0L3 4Z", transform: { x: -2, y: 1 } }, box: { width: 3 } });
    expect((edited.children[0] as SvgTreeElement).attributes).toMatchObject({ d: "M0 0L3 4Z", transform: "translate(-2 1)" });
    expect((edited.children[1] as SvgTreeElement).attributes.width).toBe("3");
    expect(() => editSvgTree(tree, { box: { width: -1 } })).toThrow(/Invalid width/);
    expect(() => editSvgTree(tree, { stream: { width: 3 } })).toThrow(/Unsupported width/);
    expect(() => editSvgTree(tree, { box: { d: "M0 0L1 1" } })).toThrow(/Unsupported path/);
    expect(() => editSvgTree(tree, { stream: { transform: { x: NaN, y: 0 } } })).toThrow(/Invalid transform/);
    expect(() => editSvgTree(tree, { stream: { d: "MNaN 1" } })).toThrow(/Invalid path/);
    expect(() => editSvgTree(tree, { stream: { d: "L1 2" } })).toThrow(/Invalid path/);
    expect(() => editSvgTree(tree, { stream: { d: "M0 0A1 1 0 2 0 2 2" } })).toThrow(/Invalid path/);
  });
  it("edits blur amounts only on blur primitives", () => {
    const tree = snapshotSvgTree({ name: "svg", attributes: {}, children: [{ name: "feGaussianBlur", attributes: { id: "blur" }, children: [] }, { name: "rect", attributes: { id: "box" }, children: [] }] });
    expect((editSvgTree(tree, { blur: { stdDeviation: 2.5 } }).children[0] as SvgTreeElement).attributes.stdDeviation).toBe("2.5");
    expect(() => editSvgTree(tree, { blur: { stdDeviation: -1 } })).toThrow(/Invalid stdDeviation/);
    expect(() => editSvgTree(tree, { box: { stdDeviation: 2 } })).toThrow(/Unsupported stdDeviation/);
  });
});
