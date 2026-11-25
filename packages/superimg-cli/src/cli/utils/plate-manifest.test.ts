import { describe, expect, it } from "vitest";
import { assertPlateBudget, atlasGrid, PLATE_MAX_FRAMES } from "./plate-manifest.js";

describe("assertPlateBudget", () => {
  it("allows a short clip", () => {
    expect(() => assertPlateBudget(48, 2)).not.toThrow();
  });

  it("rejects a long clip", () => {
    expect(() => assertPlateBudget(PLATE_MAX_FRAMES + 1, 2)).toThrow(/PLATE_TOO_LONG/);
    expect(() => assertPlateBudget(10, 7)).toThrow(/PLATE_TOO_LONG/);
  });
});

describe("atlasGrid", () => {
  it("packs 12 frames into 8 columns", () => {
    expect(atlasGrid(12)).toEqual({ columns: 8, rows: 2 });
  });

  it("shrinks columns for tiny clips", () => {
    expect(atlasGrid(3)).toEqual({ columns: 3, rows: 1 });
  });
});
