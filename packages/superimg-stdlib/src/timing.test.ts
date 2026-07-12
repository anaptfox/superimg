import { describe, expect, it } from "vitest";
import {
  durationForDistance,
  msToFraction,
  readTimeSeconds,
  sceneDuration,
  snapToBeat,
  wordCount,
} from "./timing.js";

describe("timing", () => {
  it("counts words", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("  ")).toBe(0);
  });

  it("readTimeSeconds floors at 0.8s and uses words/3", () => {
    expect(readTimeSeconds("hi")).toBe(0.8);
    expect(readTimeSeconds("one two three four five six")).toBeCloseTo(2, 5);
    expect(readTimeSeconds(9)).toBeCloseTo(3, 5);
  });

  it("sceneDuration includes enter hold exit", () => {
    const d = sceneDuration({ text: "a b c", enter: 0.5, pad: 0.5 });
    // hold = max(0.8, 1) + 0.5 = 1.5; exit = 0.5/1.25 = 0.4
    expect(d).toBeCloseTo(0.5 + 1.5 + 0.4, 5);
  });

  it("durationForDistance is sub-linear", () => {
    const base = durationForDistance(300, 100);
    const double = durationForDistance(300, 200);
    expect(double / base).toBeCloseTo(Math.pow(2, 0.4), 5);
    expect(double).toBeLessThan(base * 2);
  });

  it("msToFraction clamps", () => {
    expect(msToFraction(500, 1)).toBeCloseTo(0.5, 5);
    expect(msToFraction(2000, 1)).toBe(1);
    expect(msToFraction(100, 0)).toBe(0);
  });

  it("snapToBeat quantizes", () => {
    // 120bpm → 0.5s beat
    expect(snapToBeat(0.6, 120)).toBeCloseTo(0.5, 5);
    expect(snapToBeat(0.9, 120)).toBeCloseTo(1, 5);
  });
});
