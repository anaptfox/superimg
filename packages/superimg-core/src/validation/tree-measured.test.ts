import { describe, expect, it } from "vitest";
import { Frame, Stack, Text, Fill, walkMediaTree } from "@superimg/stdlib/tree";
import { scanTreeLayoutIssues, buildInspectTreeSnapshot } from "./tree.js";
import { scanTreePaintIssues } from "./tree-paint.js";
import { analyzeTechnicalFrame } from "./analysis.js";

const exact = { measure: (text: string) => ({ width: text.length * 10, ascent: 16, descent: 4, exact: true }) };
const walk = (tree: Parameters<typeof walkMediaTree>[0]) => walkMediaTree(tree, { width: 400, height: 240, measurer: exact });
const scan = (tree: Parameters<typeof walkMediaTree>[0]) => scanTreeLayoutIssues(walk(tree), { frame: 0, progress: 0 });
const content = () => Text({ id: "long", size: 20, maxWidth: 100, color: "#111111" }, "one two three four");

describe("measured line geometry", () => {
  it("identifies overflow and overlap with the parent and peer; auto flow grows", () => {
    const card = (fixed: boolean) => Frame({ width: 400, height: 240 }, Stack({ width: 200, gap: 0 }, Frame({ id: "holder", width: 120, ...(fixed ? { height: 24 } : {}) }, content()), Text({ id: "peer", size: 20 }, "next")));
    const broken = scan(card(true));
    expect(broken).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", severity: "error", nodeId: "long", relatedIds: ["holder"] }));
    expect(broken).toContainEqual(expect.objectContaining({ code: "FLOW_TEXT_LINE_OVERLAP", severity: "error", relatedIds: ["long", "peer"] }));
    expect(scan(card(false)).filter(i => ["TEXT_OUTSIDE_PARENT", "FLOW_TEXT_LINE_OVERLAP"].includes(i.code))).toEqual([]);
    const snapshot = buildInspectTreeSnapshot(walk(card(true)));
    expect(snapshot.nodes.find(n => n.id === "long")?.textGeometry?.lines.length).toBeGreaterThan(1);
    expect(snapshot.nodes.find(n => n.id === "holder")?.layoutRole).toBe("flow");
    expect(snapshot.nodes.find(n => n.id === "long")?.layoutRole).toBe("layer");
    const result = analyzeTechnicalFrame({ frame: 0, progress: 0, width: 400, height: 240, html: "<div>content</div>", nodes: walk(card(true)), background: "#ffffff" });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", nodeId: "long" }));
  });
  it("treats approximations as warnings and deliberate Frame layers as intentional", () => {
    const overlay = Frame({ width: 200, height: 100 }, Text({ id: "a", size: 20 }, "same"), Text({ id: "b", size: 20 }, "same"));
    expect(scan(overlay).some(i => i.code === "FLOW_TEXT_LINE_OVERLAP")).toBe(false);
    const bad = Frame({ width: 400, height: 240 }, Stack({ width: 200 }, Frame({ width: 100, height: 20 }, content()), Text({ id: "peer", size: 20 }, "next")));
    const issues = scanTreeLayoutIssues(walkMediaTree(bad), { frame: 0, progress: 0 });
    expect(issues).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", severity: "warning" }));
    const longWord = Frame({ width: 200, height: 100 }, Frame({ id: "narrow", width: 50, height: 80 }, Text({ id: "word", size: 20 }, "unbreakable")));
    expect(scan(longWord)).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", nodeId: "word", relatedIds: ["narrow"] }));
  });
  it("handles translated and clipped flow, and reports unsupported transforms", () => {
    const translated = Frame({ width: 400, height: 240 }, Stack({ width: 200 }, Frame({ id: "holder", width: 120, height: 24, style: { transform: "translateX(20px)" } }, content()), Text({ id: "peer", size: 20 }, "next")));
    const node = walk(translated).find(n => n.id === "long")!;
    expect(node.textGeometry!.lines[0]!.bounds.x).toBe(20);
    const clipped = Frame({ width: 400, height: 240 }, Stack({ width: 200 }, Frame({ width: 120, height: 24, overflow: "hidden" }, content()), Text({ id: "peer", size: 20 }, "next")));
    expect(scan(clipped).some(i => i.code === "FLOW_TEXT_LINE_OVERLAP")).toBe(false);
    const rotated = Frame({ width: 400, height: 240 }, Frame({ width: 120, height: 24, style: { transform: "rotate(30deg)" } }, content()));
    expect(scan(rotated)).toContainEqual(expect.objectContaining({ code: "TEXT_GEOMETRY_UNVERIFIED", nodeId: "long" }));
    const coverage = analyzeTechnicalFrame({ frame: 0, progress: 0, width: 400, height: 240, html: "<div>content</div>", nodes: walk(rotated), background: "#ffffff" }).coverage;
    expect(coverage.unsupported).toContain("complex-text-geometry");
    const nested = Frame({ width: 400, height: 240 }, Frame({ width: 150, height: 100, overflow: "hidden", style: { transform: "translateX(10px)" } }, Frame({ width: 120, height: 24, overflow: "hidden", style: { transform: "translateY(5px)" } }, content())));
    const nestedText = walk(nested).find(n => n.id === "long")!;
    expect(nestedText.textGeometry?.lines[0]?.bounds).toMatchObject({ x: 10, y: 5 });
    expect(nestedText.spatial?.clip).toEqual({ x: 10, y: 5, width: 120, height: 24 });
    expect(scan(nested)).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", severity: "warning" }));
    const animated = Frame({ width: 400, height: 240 }, Frame({ width: 120, height: 24, motion: { style: "transform:translateY(0px)", x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, phase: "entering" } }, content()));
    expect(scan(animated)).toContainEqual(expect.objectContaining({ code: "TEXT_OUTSIDE_PARENT", severity: "warning", details: expect.objectContaining({ transient: true }) }));
  });
});

describe("local paint order", () => {
  const check = (tree: Parameters<typeof walkMediaTree>[0]) => scanTreePaintIssues(walk(tree), { frame: 0, progress: 0, width: 400, height: 240 });
  it("uses a local opaque frame instead of the stage, including real failures", () => {
    const card = (color: string) => Frame({ width: 400, height: 240 }, Fill({ color: "#ffffff" }), Frame({ width: 200, height: 100, fill: "#111111" }, Text({ id: "label", size: 20, color }, "hello")));
    expect(check(card("#ffffff")).some(i => i.code === "LOW_CONTRAST_TEXT")).toBe(false);
    expect(check(card("#111111"))).toContainEqual(expect.objectContaining({ code: "LOW_CONTRAST_TEXT", nodeId: "label", details: expect.objectContaining({ floor: "#111111" }) }));
  });
  it("treats partial backgrounds as unverified and ignores later overlays as backgrounds", () => {
    const tree = Frame({ width: 400, height: 240, fill: "#ffffff" }, Fill({ x: 0, y: 0, width: 20, height: 80, color: "#111111" }), Text({ id: "label", size: 20, color: "#111111" }, "hello"));
    expect(check(tree)).toContainEqual(expect.objectContaining({ code: "TEXT_PAINT_UNVERIFIED" }));
    const later = Frame({ width: 400, height: 240, fill: "#ffffff" }, Text({ id: "label", size: 20, color: "#111111" }, "hello"), Fill({ color: "#111111" }));
    expect(check(later).some(i => i.code === "LOW_CONTRAST_TEXT")).toBe(false);
    expect(check(later)).toContainEqual(expect.objectContaining({ code: "TEXT_PAINT_UNVERIFIED", details: expect.objectContaining({ reason: "later-paint-may-occlude" }) }));
  });
  it("does not certify transparent, partially opaque, or image backgrounds", () => {
    const mixed = Frame({ width: 400, height: 240, fill: "#ffffff" }, Frame({ width: 200, height: 100, fill: "#111111", style: { opacity: 0.5 } }, Text({ id: "label", size: 20, color: "#ffffff" }, "hello")));
    expect(check(mixed)).toContainEqual(expect.objectContaining({ code: "TEXT_PAINT_UNVERIFIED", nodeId: "label" }));
    expect(check(mixed).some(i => i.code === "LOW_CONTRAST_TEXT")).toBe(false);
    const transparent = Frame({ width: 400, height: 240, fill: "#ffffff" }, Frame({ width: 200, height: 100, fill: "transparent" }, Text({ id: "label", size: 20, color: "#111111" }, "hello")));
    expect(check(transparent).some(i => i.code === "TEXT_PAINT_UNVERIFIED" || i.code === "LOW_CONTRAST_TEXT")).toBe(false);
  });
});
