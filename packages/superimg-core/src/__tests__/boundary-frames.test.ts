import { describe, expect, it } from "vitest";
import { selectBoundaryFrames } from "../ir/index.js";

describe("selectBoundaryFrames", () => {
  it("samples both sides of half-open boundaries in the 57-frame story", () => {
    expect(selectBoundaryFrames([
      { startFrame: 32, endFrame: 57 },
      { startFrame: 0, endFrame: 25 },
      { startFrame: 25, endFrame: 32 },
      { startFrame: 25, endFrame: 32 },
    ], 57)).toEqual([0, 24, 25, 31, 32, 56]);
  });

  it("bounds overlapping and simultaneous ranges to the resolved clock", () => {
    expect(selectBoundaryFrames([
      { startFrame: 0, endFrame: 1 },
      { startFrame: 0, endFrame: 7 },
      { startFrame: 6, endFrame: 12 },
    ], 7)).toEqual([0, 1, 5, 6]);
    expect(selectBoundaryFrames([{ startFrame: 0, endFrame: 1 }], 1)).toEqual([0]);
    expect(selectBoundaryFrames([], 7)).toEqual([]);
  });

  it("requires a positive integer frame count and excludes invalid frame candidates", () => {
    for (const frames of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => selectBoundaryFrames([], frames)).toThrow(/positive safe integer/);
    }
    expect(selectBoundaryFrames([
      { startFrame: NaN, endFrame: Infinity },
      { startFrame: 1.5, endFrame: 2.5 },
    ], 7)).toEqual([]);
  });
});
