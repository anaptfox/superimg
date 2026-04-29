import { describe, it, expect } from "vitest";
import { getCodeFrame } from "../code-frame.js";

describe("getCodeFrame", () => {
  it("renders a Vite-style frame around line 3", () => {
    const src = ["line one", "line two", "BAD line", "line four", "line five"].join("\n");
    const frame = getCodeFrame(src, 3, 0);
    expect(frame).toContain("BAD line");
    expect(frame).toMatch(/>\s*3\s*\|/); // marker line
  });

  it("returns empty string for empty source", () => {
    expect(getCodeFrame("", 1, 0)).toBe("");
  });

  it("places caret approximately at the column", () => {
    const src = "abc def ghi";
    const frame = getCodeFrame(src, 1, 4); // column 4 is 'd'
    // @babel/code-frame draws a `^` line aligned under the column.
    expect(frame).toMatch(/\|.*\^/);
  });

  it("respects linesAbove/linesBelow", () => {
    const src = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
    const frame = getCodeFrame(src, 5, 0, { linesAbove: 1, linesBelow: 1 });
    expect(frame).toContain("line 4");
    expect(frame).toContain("line 5");
    expect(frame).toContain("line 6");
    expect(frame).not.toContain("line 3");
    expect(frame).not.toContain("line 7");
  });
});
