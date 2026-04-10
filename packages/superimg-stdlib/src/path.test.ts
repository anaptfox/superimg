import { describe, it, expect } from "vitest";
import { path, createMotionPath } from "./path";

describe("path", () => {
  it("returns start position at progress 0", () => {
    const pt = path("M 0 0 L 100 0", 0);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("returns end position at progress 1", () => {
    const pt = path("M 0 0 L 100 0", 1);
    expect(pt.x).toBeCloseTo(100, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("returns midpoint at progress 0.5", () => {
    const pt = path("M 0 0 L 200 0", 0.5);
    expect(pt.x).toBeCloseTo(100, 1);
    expect(pt.y).toBeCloseTo(0, 1);
  });

  it("returns angle for horizontal line", () => {
    const pt = path("M 0 0 L 100 0", 0.5);
    expect(pt.angle).toBeCloseTo(0, 0);
  });

  it("returns angle for vertical line", () => {
    const pt = path("M 0 0 L 0 100", 0.5);
    expect(pt.angle).toBeCloseTo(90, 0);
  });

  it("includes transform string", () => {
    const pt = path("M 0 0 L 100 0", 0.5);
    expect(pt.transform).toContain("translate(");
    expect(pt.transform).toContain("rotate(");
  });

  it("omits rotation when rotate: false", () => {
    const pt = path("M 0 0 L 100 0", 0.5, { rotate: false });
    expect(pt.transform).toContain("translate(");
    expect(pt.transform).not.toContain("rotate(");
  });

  it("applies rotateOffset", () => {
    const pt = path("M 0 0 L 100 0", 0.5, { rotateOffset: 90 });
    expect(pt.angle).toBeCloseTo(90, 0);
  });

  it("applies easing to progress", () => {
    // easeInQuad: t*t, so at p=0.5, eased = 0.25
    const pt = path("M 0 0 L 100 0", 0.5, { easing: "easeInQuad" });
    expect(pt.x).toBeCloseTo(25, 0);
  });

  it("works with cubic bezier paths", () => {
    const pt = path("M 0 0 C 50 0 50 100 100 100", 0);
    expect(pt.x).toBeCloseTo(0, 1);
    expect(pt.y).toBeCloseTo(0, 1);
    const ptEnd = path("M 0 0 C 50 0 50 100 100 100", 1);
    expect(ptEnd.x).toBeCloseTo(100, 1);
    expect(ptEnd.y).toBeCloseTo(100, 1);
  });
});

describe("createMotionPath", () => {
  it("returns a ParsedPath with .at() and .length", () => {
    const p = createMotionPath("M 0 0 L 300 400");
    expect(p.length).toBeCloseTo(500, 0);
    const pt = p.at(0.5);
    expect(pt.x).toBeCloseTo(150, 0);
    expect(pt.y).toBeCloseTo(200, 0);
  });

  it("supports options in .at()", () => {
    const p = createMotionPath("M 0 0 L 100 0");
    const pt = p.at(0.5, { rotate: false });
    expect(pt.transform).not.toContain("rotate(");
  });
});
