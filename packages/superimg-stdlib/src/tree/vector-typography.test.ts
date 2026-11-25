import { describe, expect, it, vi } from "vitest";
import { Vector, vector } from "./vector.js";
import { walkMediaTree } from "./walk.js";

describe("vector text inspection", () => {
  it("inherits paint and opacity and applies anchor before transforms", () => {
    const tree = Vector({ width: 200, height: 100 }, vector.group({ fill: "#123456", opacity: 0.5, transform: { x: 10, scale: 2 } }, vector.text({ id: "label", x: 30, y: 20, size: 10, family: "Inter", anchor: "middle" }, "AB")));
    const label = walkMediaTree(tree, { width: 200, height: 100 }).find(node => node.id === "label")!;
    expect(label.color).toBe("#123456");
    expect(label.paint?.opacity).toBe(0.5);
    expect(label.bounds).toMatchObject({ x: 59, y: 24, width: 22, height: 20, estimated: true });
    expect(label.typography).toMatchObject({ fontSize: 10, fontFamily: "Inter", anchor: "middle", metricsSource: "heuristic" });
  });
  it("uses the selected font measurer while keeping bounds identified as source estimates", () => {
    const measure = vi.fn(() => ({ width: 40, ascent: 12, descent: 3, exact: true }));
    const tree = Vector({ width: 200, height: 100 }, vector.text({ id: "label", x: 100, y: 20, size: 16, family: "Fixture", weight: 700, anchor: "end" }, "AB"));
    const label = walkMediaTree(tree, { width: 200, height: 100, measurer: { measure } }).find(node => node.id === "label")!;
    expect(measure).toHaveBeenCalledWith("AB", expect.objectContaining({ fontFamily: "Fixture", fontSize: 16, fontWeight: 700 }));
    expect(label).toMatchObject({ metricsExact: true, bounds: { x: 60, y: 8, width: 40, height: 15, estimated: true }, typography: { metricsSource: "font" } });
  });
  it("keeps styled native runs explicitly estimated and complex instead of claiming one measured font/paint", () => {
    const measure = vi.fn(() => ({ width: 40, ascent: 12, descent: 3, exact: true }));
    const tree = Vector({ width: 200, height: 100 }, vector.group({ style: { fontFamily: "Fixture", fontSize: 16, textAnchor: "end", fill: "#222222" } }, vector.text({ id: "label", x: 100, y: 20 }, "A", vector.run({ fill: "#ffffff", dx: 10 }, "B"))));
    const label = walkMediaTree(tree, { width: 200, height: 100, measurer: { measure } }).find(node => node.id === "label")!;
    expect(label).toMatchObject({ text: "AB", metricsExact: false, paint: { complex: true }, typography: { fontFamily: "Fixture", anchor: "end", metricsSource: "heuristic" } });
    expect(measure).toHaveBeenCalledWith("AB", expect.objectContaining({ fontFamily: "Fixture", fontSize: 16 }));
  });

});
