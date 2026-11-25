import { describe, expect, it } from "vitest";
import { resolveVariantFrame } from "./variant-at.js";

describe("resolveVariantFrame", () => {
  it("maps progress 0–1", () => {
    expect(resolveVariantFrame(0, 30, 1)).toBe(0);
    expect(resolveVariantFrame(1, 30, 1)).toBe(29);
    expect(resolveVariantFrame(0.5, 30, 1)).toBe(15);
  });

  it("maps percent strings", () => {
    expect(resolveVariantFrame("50%", 10, 1)).toBe(5);
  });

  it("maps frame:N", () => {
    expect(resolveVariantFrame("frame:12", 30, 2)).toBe(12);
  });

  it("maps frame index when number > 1", () => {
    expect(resolveVariantFrame(10, 30, 2)).toBe(10);
  });

  it("returns undefined when at omitted", () => {
    expect(resolveVariantFrame(undefined, 30, 1)).toBeUndefined();
  });
});
