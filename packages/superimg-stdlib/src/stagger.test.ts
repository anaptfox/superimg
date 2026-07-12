import { describe, expect, it } from "vitest";
import { stagger, staggerLead, staggerPlan } from "./stagger.js";

describe("stagger — count mode", () => {
  it("returns empty for count <= 0", () => {
    expect(stagger(0, 0.5)).toEqual([]);
  });

  it("returns single progress for count 1", () => {
    // Default easeOutCubic(0.5) > 0.5
    expect(stagger(1, 0.5)[0]!).toBeGreaterThan(0.5);
    expect(stagger(1, 1)).toEqual([1]);
    expect(stagger(1, 0.5, { easing: "linear" })).toEqual([0.5]);
  });

  it("distributes with duration option", () => {
    const atHalf = stagger(3, 0.5, { duration: 0.4 });
    expect(atHalf).toHaveLength(3);
    expect(atHalf[0]!).toBeGreaterThan(atHalf[1]!);
    expect(atHalf[1]!).toBeGreaterThan(atHalf[2]!);
  });

  it("orders from end first", () => {
    const p = stagger(3, 0.6, { duration: 0.5, from: "end" });
    expect(p[2]!).toBeGreaterThan(p[0]!);
  });
});

describe("stagger — items mode", () => {
  it("returns enriched items with active and done", () => {
    const items = stagger(["A", "B", "C"], 0, { duration: 0.5 });
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ item: "A", index: 0, progress: 0, active: false, done: false });
  });

  it("marks done when progress completes", () => {
    const items = stagger(["A", "B"], 1, { duration: 0.8 });
    expect(items.every((i) => i.done)).toBe(true);
    expect(items.every((i) => !i.active)).toBe(true);
  });

  it("supports from center", () => {
    const items = stagger(["A", "B", "C"], 0.5, { duration: 0.4, from: "center" });
    expect(items[1]!.progress).toBeGreaterThanOrEqual(items[0]!.progress);
  });
});

describe("staggerLead", () => {
  it("returns index of item with highest progress above threshold", () => {
    const idx = staggerLead(["A", "B", "C"], 0.5, { duration: 0.5, threshold: 0.2 });
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });

  it("returns 0 when nothing has started", () => {
    expect(staggerLead(["A", "B", "C"], 0, { duration: 0.5 })).toBe(0);
  });
});

describe("stagger plan / ms (omakase)", () => {
  it("caps total cascade at 500ms for many items", () => {
    const plan = staggerPlan(20, { windowSeconds: 2, eachMs: 50, capMs: 500 });
    expect(plan.totalMs).toBeLessThanOrEqual(500);
    expect(plan.eachMs).toBeLessThan(50);
  });

  it("stagger.ms never exceeds cap", () => {
    const items = Array.from({ length: 20 }, (_, i) => `i${i}`);
    const result = stagger.ms(items, 0.5, {
      windowSeconds: 1.5,
      eachMs: 80,
      capMs: 500,
    });
    expect(result[0]!.totalStaggerMs).toBeLessThanOrEqual(500);
    expect(result[result.length - 1]!.startMs).toBeLessThanOrEqual(500);
  });

  it("default easing is easeOutCubic (midpoint > linear)", () => {
    // With easeOutCubic at raw 0.5, eased > 0.5
    const [p] = stagger(1, 0.5);
    expect(p).toBeGreaterThan(0.5);
  });
});
