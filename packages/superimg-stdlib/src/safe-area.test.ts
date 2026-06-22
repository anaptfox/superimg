import { describe, it, expect } from "vitest";
import { getAspectKind, getSafeArea } from "./safe-area";

describe("safe-area", () => {
  it("detects aspect kinds", () => {
    expect(getAspectKind(1920, 1080)).toBe("landscape");
    expect(getAspectKind(1080, 1920)).toBe("portrait");
    expect(getAspectKind(1080, 1080)).toBe("square");
  });

  it("returns broadcast insets for landscape", () => {
    const insets = getSafeArea(1920, 1080, "broadcast");
    expect(insets.top).toBe(108);
    expect(insets.left).toBe(96);
  });

  it("returns zero insets for none", () => {
    expect(getSafeArea(1920, 1080, "none")).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("returns portrait broadcast insets", () => {
    const insets = getSafeArea(1080, 1920, "broadcast");
    expect(insets.top).toBe(230);
    expect(insets.bottom).toBe(269);
    expect(insets.left).toBe(65);
    expect(insets.right).toBe(65);
  });

  it("returns square broadcast insets", () => {
    const insets = getSafeArea(1080, 1080, "broadcast");
    expect(insets.top).toBe(108);
    expect(insets.left).toBe(86);
    expect(insets.right).toBe(86);
    expect(insets.bottom).toBe(108);
  });

  it("classifies near-square as square", () => {
    expect(getAspectKind(1000, 950)).toBe("square");
  });

  it("defaults to broadcast preset", () => {
    expect(getSafeArea(1920, 1080)).toEqual(getSafeArea(1920, 1080, "broadcast"));
  });
});