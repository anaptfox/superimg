import { describe, it, expect } from "vitest";
import { oscillate, loop, pingpong, wiggle } from "./oscillate";

describe("oscillate", () => {
  it("returns midpoint at t=0 (sine phase)", () => {
    expect(oscillate(0, { period: 1 })).toBeCloseTo(0, 5);
  });

  it("oscillates between from and to", () => {
    const atQuarter = oscillate(0.25, { period: 1, from: 0, to: 10 });
    expect(atQuarter).toBeGreaterThan(0);
    expect(atQuarter).toBeLessThanOrEqual(10);
  });

  it("parses string period in seconds", () => {
    const a = oscillate(0.5, { period: "2s", from: 0, to: 1 });
    const b = oscillate(0.5, { period: 2, from: 0, to: 1 });
    expect(a).toBeCloseTo(b, 10);
  });

  it("parses string period in milliseconds", () => {
    const a = oscillate(0.25, { period: "500ms", from: -1, to: 1 });
    const b = oscillate(0.25, { period: 0.5, from: -1, to: 1 });
    expect(a).toBeCloseTo(b, 10);
  });

  it("throws for invalid period string", () => {
    expect(() => oscillate(0, { period: "2sec" })).toThrow(/must end with/);
  });
});

describe("loop", () => {
  it("returns 0 at t=0", () => {
    expect(loop(0, { period: 2 })).toBe(0);
  });

  it("returns 0 at period boundary", () => {
    expect(loop(2, { period: 2 })).toBe(0);
  });

  it("ramps linearly within period", () => {
    expect(loop(1, { period: 2 })).toBeCloseTo(0.5, 5);
  });

  it("accepts string period", () => {
    expect(loop(1, { period: "2s" })).toBeCloseTo(0.5, 5);
  });
});

describe("pingpong", () => {
  it("returns 0 at t=0", () => {
    expect(pingpong(0, { period: 2 })).toBe(0);
  });

  it("returns 1 at half period", () => {
    expect(pingpong(1, { period: 2 })).toBeCloseTo(1, 5);
  });

  it("returns 0 at full period", () => {
    expect(pingpong(2, { period: 2 })).toBeCloseTo(0, 5);
  });
});

describe("wiggle", () => {
  it("is deterministic for same seed and time", () => {
    const a = wiggle(1.5, 42, { freq: 2, amp: 8 });
    const b = wiggle(1.5, 42, { freq: 2, amp: 8 });
    expect(a).toBe(b);
  });

  it("differs for different seeds", () => {
    const a = wiggle(1, 0);
    const b = wiggle(1, 1);
    expect(a).not.toBe(b);
  });

  it("scales with amplitude", () => {
    const small = wiggle(2, 5, { amp: 1 });
    const large = wiggle(2, 5, { amp: 4 });
    expect(Math.abs(large)).toBeGreaterThan(Math.abs(small));
  });

  it("defaults freq and amp to 1", () => {
    const value = wiggle(0.5, 0);
    expect(Math.abs(value)).toBeLessThanOrEqual(1);
  });
});