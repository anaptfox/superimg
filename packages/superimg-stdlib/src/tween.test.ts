import { describe, it, expect } from "vitest";
import { tween, EASING_NAMES, type EasingName } from "./tween";
import * as easing from "./easing";

describe("tween", () => {
  describe("basic (linear)", () => {
    it("returns from at progress 0", () => {
      expect(tween(0, 100, 0)).toBe(0);
      expect(tween(10, 50, 0)).toBe(10);
    });

    it("returns to at progress 1", () => {
      expect(tween(0, 100, 1)).toBe(100);
      expect(tween(10, 50, 1)).toBe(50);
    });

    it("returns midpoint at progress 0.5 (linear)", () => {
      expect(tween(0, 100, 0.5)).toBe(50);
    });

    it("handles negative ranges", () => {
      expect(tween(-10, 10, 0.5)).toBe(0);
    });
  });

  describe("with easing name", () => {
    it("uses easeOutCubic", () => {
      const v = tween(0, 100, 0.5, "easeOutCubic");
      expect(v).toBeGreaterThan(50);
      expect(v).toBeLessThanOrEqual(100);
    });

    it("uses easeInCubic", () => {
      const v = tween(0, 100, 0.5, "easeInCubic");
      expect(v).toBeLessThan(50);
      expect(v).toBeGreaterThanOrEqual(0);
    });

    it("throws for unknown easing name", () => {
      expect(() => tween(0, 100, 0.5, "invalid" as EasingName)).toThrow(
        /Unknown easing/
      );
    });
  });

  describe("with easing function", () => {
    it("uses custom easing", () => {
      const double = (t: number) => Math.min(1, t * 2);
      expect(tween(0, 100, 0.5, double)).toBe(100);
    });
  });

  describe("windowing (start/end)", () => {
    it("returns from before start", () => {
      expect(tween(0, 100, 0.1, { start: 0.2, end: 0.6 })).toBe(0);
    });

    it("returns to after end", () => {
      expect(tween(0, 100, 0.9, { start: 0.2, end: 0.6 })).toBe(100);
    });

    it("animates within window", () => {
      const v = tween(0, 100, 0.4, { start: 0.2, end: 0.6 });
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    });

    it("midpoint of window maps to midpoint", () => {
      const v = tween(0, 100, 0.4, { start: 0.2, end: 0.6 });
      expect(v).toBeCloseTo(50, 0);
    });

    it("combines window with easing", () => {
      const v = tween(0, 100, 0.4, {
        easing: "easeOutCubic",
        start: 0.2,
        end: 0.6,
      });
      expect(v).toBeGreaterThan(50);
      expect(v).toBeLessThanOrEqual(100);
    });

    it("throws when start > end", () => {
      expect(() =>
        tween(0, 100, 0.5, { start: 0.6, end: 0.2 })
      ).toThrow(/start.*must be <= end/);
    });

    it("step semantics when start === end", () => {
      expect(tween(0, 100, 0.2, { start: 0.5, end: 0.5 })).toBe(0);
      expect(tween(0, 100, 0.5, { start: 0.5, end: 0.5 })).toBe(100);
      expect(tween(0, 100, 0.6, { start: 0.5, end: 0.5 })).toBe(100);
    });
  });

  describe("out-of-range progress", () => {
    it("clamps progress < 0 to from", () => {
      expect(tween(0, 100, -1)).toBe(0);
    });

    it("clamps progress > 1 to to", () => {
      expect(tween(0, 100, 2)).toBe(100);
    });
  });

  describe("EASING_NAMES sync", () => {
    const easingFnNames = Object.keys(easing).filter(
      (k) => typeof (easing as Record<string, unknown>)[k] === "function" && k !== "clamp01"
    );

    it("EASING_NAMES matches exported easing functions (except clamp01)", () => {
      expect([...EASING_NAMES].sort()).toEqual([...easingFnNames].sort());
    });

    it("every EASING_NAMES entry works with tween", () => {
      for (const name of EASING_NAMES) {
        expect(tween(0, 100, 0, name)).toBeCloseTo(0, 10);
        expect(tween(0, 100, 1, name)).toBeCloseTo(100, 10);
        const v = tween(0, 100, 0.5, name);
        expect(Number.isFinite(v)).toBe(true);
      }
    });
  });
});
