import { describe, it, expect } from "vitest";
import { normalizePath, pointAtProgress, angleAtProgress, cubicPoint, serializePath } from "./segments";

describe("segments", () => {
  describe("normalizePath", () => {
    it("parses a straight line", () => {
      const np = normalizePath("M 0 0 L 100 0");
      expect(np.segments).toHaveLength(1);
      expect(np.totalLength).toBeCloseTo(100, 1);
    });

    it("parses a cubic bezier", () => {
      const np = normalizePath("M 0 0 C 50 0 50 100 100 100");
      expect(np.segments).toHaveLength(1);
      expect(np.segments[0].type).toBe("C");
      expect(np.totalLength).toBeGreaterThan(100);
    });

    it("handles multiple segments", () => {
      const np = normalizePath("M 0 0 L 100 0 L 100 100");
      expect(np.segments).toHaveLength(2);
      expect(np.totalLength).toBeCloseTo(200, 1);
    });

    it("normalizes relative commands to absolute", () => {
      const np = normalizePath("M 0 0 l 100 0 l 0 100");
      expect(np.segments).toHaveLength(2);
      expect(np.totalLength).toBeCloseTo(200, 1);
    });

    it("normalizes Q to C", () => {
      const np = normalizePath("M 0 0 Q 50 100 100 0");
      expect(np.segments).toHaveLength(1);
      expect(np.segments[0].type).toBe("C");
    });

    it("caches parsed results", () => {
      const a = normalizePath("M 0 0 L 50 50");
      const b = normalizePath("M 0 0 L 50 50");
      expect(a).toBe(b);
    });
  });

  describe("pointAtProgress", () => {
    it("returns start point at progress 0", () => {
      const np = normalizePath("M 10 20 L 110 20");
      const pt = pointAtProgress(np, 0);
      expect(pt.x).toBeCloseTo(10, 1);
      expect(pt.y).toBeCloseTo(20, 1);
    });

    it("returns end point at progress 1", () => {
      const np = normalizePath("M 10 20 L 110 20");
      const pt = pointAtProgress(np, 1);
      expect(pt.x).toBeCloseTo(110, 1);
      expect(pt.y).toBeCloseTo(20, 1);
    });

    it("returns midpoint at progress 0.5 for a line", () => {
      const np = normalizePath("M 0 0 L 100 0");
      const pt = pointAtProgress(np, 0.5);
      expect(pt.x).toBeCloseTo(50, 1);
      expect(pt.y).toBeCloseTo(0, 1);
    });

    it("clamps progress to [0, 1]", () => {
      const np = normalizePath("M 0 0 L 100 0");
      const before = pointAtProgress(np, -0.5);
      const after = pointAtProgress(np, 1.5);
      expect(before.x).toBeCloseTo(0, 1);
      expect(after.x).toBeCloseTo(100, 1);
    });
  });

  describe("angleAtProgress", () => {
    it("returns 0 degrees for horizontal right line", () => {
      const np = normalizePath("M 0 0 L 100 0");
      expect(angleAtProgress(np, 0.5)).toBeCloseTo(0, 0);
    });

    it("returns 90 degrees for vertical down line", () => {
      const np = normalizePath("M 0 0 L 0 100");
      expect(angleAtProgress(np, 0.5)).toBeCloseTo(90, 0);
    });

    it("returns 180 degrees for horizontal left line", () => {
      const np = normalizePath("M 100 0 L 0 0");
      expect(angleAtProgress(np, 0.5)).toBeCloseTo(180, 0);
    });

    it("returns 45 degrees for diagonal line", () => {
      const np = normalizePath("M 0 0 L 100 100");
      expect(angleAtProgress(np, 0.5)).toBeCloseTo(45, 0);
    });
  });

  describe("cubicPoint", () => {
    it("returns start point at t=0", () => {
      const pt = cubicPoint(0, 0, 50, 0, 50, 100, 100, 100, 0);
      expect(pt.x).toBe(0);
      expect(pt.y).toBe(0);
    });

    it("returns end point at t=1", () => {
      const pt = cubicPoint(0, 0, 50, 0, 50, 100, 100, 100, 1);
      expect(pt.x).toBe(100);
      expect(pt.y).toBe(100);
    });
  });

  describe("serializePath", () => {
    it("serializes M, L, Z segments", () => {
      const result = serializePath([
        { key: "M", data: [0, 0] },
        { key: "L", data: [100, 100] },
        { key: "Z", data: [] },
      ]);
      expect(result).toBe("M0,0 L100,100 Z");
    });
  });
});
