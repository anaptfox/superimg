import { describe, it, expect } from "vitest";
import { spring, springCurve } from "./spring";

describe("springCurve", () => {
  it("returns 0 at progress 0", () => {
    expect(springCurve(0)).toBe(0);
  });

  it("returns 1 at progress 1", () => {
    expect(springCurve(1)).toBe(1);
  });

  it("overshoots with low damping (underdamped)", () => {
    const mid = springCurve(0.4, { stiffness: 200, damping: 5 });
    expect(mid).toBeGreaterThan(0.4);
  });

  it("settles without overshoot with high damping (overdamped)", () => {
    const values = [0.2, 0.4, 0.6, 0.8].map((p) => springCurve(p, { stiffness: 100, damping: 30 }));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("overshoots 1 during underdamped motion", () => {
    let max = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      max = Math.max(max, springCurve(p, { stiffness: 200, damping: 5 }));
    }
    expect(max).toBeGreaterThan(1);
  });

  it("handles critically damped case (zeta = 1)", () => {
    const stiffness = 100;
    const mass = 1;
    const damping = 2 * Math.sqrt(stiffness * mass);
    const mid = springCurve(0.5, { stiffness, damping, mass });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("spring", () => {
  it("returns from at progress 0", () => {
    expect(spring(10, 50, 0)).toBe(10);
  });

  it("returns to at progress 1", () => {
    expect(spring(10, 50, 1)).toBe(50);
  });

  it("interpolates between from and to", () => {
    const value = spring(0, 100, 0.5, { stiffness: 100, damping: 30 });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it("supports negative ranges", () => {
    const value = spring(-10, 10, 0.5, { stiffness: 100, damping: 20 });
    expect(value).toBeGreaterThan(-10);
    expect(value).toBeLessThan(10);
  });
});