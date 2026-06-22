import { describe, it, expect } from "vitest";
import { interpolate, interpolateColor } from "./interpolate";

describe("interpolate", () => {
  it("returns midpoint for two-point linear range", () => {
    expect(interpolate(0.5, [0, 1], [0, 100])).toBe(50);
  });

  it("clamps below input range", () => {
    expect(interpolate(-0.5, [0, 1], [10, 20])).toBe(10);
  });

  it("clamps above input range", () => {
    expect(interpolate(1.5, [0, 1], [10, 20])).toBe(20);
  });

  it("handles multi-segment fade in, hold, fade out", () => {
    expect(interpolate(0, [0, 0.2, 0.8, 1], [0, 1, 1, 0])).toBe(0);
    expect(interpolate(0.1, [0, 0.2, 0.8, 1], [0, 1, 1, 0])).toBe(0.5);
    expect(interpolate(0.5, [0, 0.2, 0.8, 1], [0, 1, 1, 0])).toBe(1);
    expect(interpolate(0.9, [0, 0.2, 0.8, 1], [0, 1, 1, 0])).toBe(0.5);
    expect(interpolate(1, [0, 0.2, 0.8, 1], [0, 1, 1, 0])).toBe(0);
  });

  it("supports arbitrary input ranges", () => {
    expect(interpolate(25, [0, 50, 100], [0, 50, 100])).toBe(25);
    expect(interpolate(75, [0, 50, 100], [0, 50, 100])).toBe(75);
  });

  it("applies easing per segment", () => {
    const linear = interpolate(0.5, [0, 1], [0, 100]);
    const eased = interpolate(0.5, [0, 1], [0, 100], "easeOutCubic");
    expect(eased).toBeGreaterThan(linear);
  });

  it("accepts custom easing function", () => {
    const double = (t: number) => Math.min(1, t * 2);
    expect(interpolate(0.5, [0, 1], [0, 100], double)).toBe(100);
  });

  it("throws when inputRange has fewer than 2 values", () => {
    expect(() => interpolate(0.5, [0], [0])).toThrow(/at least 2 values/);
  });

  it("throws when ranges have different lengths", () => {
    expect(() => interpolate(0.5, [0, 1], [0, 50, 100])).toThrow(/same length/);
  });
});

describe("interpolateColor", () => {
  it("returns start color below range", () => {
    expect(interpolateColor(-0.1, [0, 1], ["#ff0000", "#0000ff"])).toBe("#ff0000");
  });

  it("returns end color above range", () => {
    expect(interpolateColor(1.1, [0, 1], ["#ff0000", "#0000ff"])).toBe("#0000ff");
  });

  it("mixes at midpoint", () => {
    const mid = interpolateColor(0.5, [0, 1], ["#ff0000", "#0000ff"]);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/i);
    expect(mid).not.toBe("#ff0000");
    expect(mid).not.toBe("#0000ff");
  });

  it("steps through multi-stop gradient", () => {
    const at25 = interpolateColor(0.25, [0, 0.5, 1], ["#ff0000", "#00ff00", "#0000ff"]);
    const at75 = interpolateColor(0.75, [0, 0.5, 1], ["#ff0000", "#00ff00", "#0000ff"]);
    expect(at25).not.toBe(at75);
  });

  it("applies easing to color mix", () => {
    const linear = interpolateColor(0.5, [0, 1], ["#000000", "#ffffff"]);
    const eased = interpolateColor(0.5, [0, 1], ["#000000", "#ffffff"], "easeOutCubic");
    expect(eased).not.toBe(linear);
  });

  it("throws when inputRange has fewer than 2 values", () => {
    expect(() => interpolateColor(0.5, [0], ["#ff0000"])).toThrow(/at least 2 values/);
  });

  it("throws when ranges and colors differ in length", () => {
    expect(() => interpolateColor(0.5, [0, 1], ["#ff0000"])).toThrow(/same length/);
  });
});