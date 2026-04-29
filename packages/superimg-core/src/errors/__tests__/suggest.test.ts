import { describe, it, expect } from "vitest";
import { didYouMean, levenshtein } from "../suggest.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("foo", "foo")).toBe(0);
  });

  it("returns length when one string is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("counts a single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });

  it("counts insertions and deletions", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
    expect(levenshtein("cats", "cat")).toBe(1);
  });
});

describe("didYouMean", () => {
  const easings = ["linear", "easeIn", "easeOut", "easeInOut", "easeInQuad"];

  it("returns close match within distance 2", () => {
    expect(didYouMean("ezeIn", easings)).toBe("easeIn");
    expect(didYouMean("eseInOut", easings)).toBe("easeInOut");
  });

  it("ignores case by default", () => {
    expect(didYouMean("LINEAR", easings)).toBe("linear");
  });

  it("returns null when no candidate is close", () => {
    expect(didYouMean("totallyUnrelated", easings)).toBeNull();
  });

  it("returns null for empty candidate list", () => {
    expect(didYouMean("foo", [])).toBeNull();
  });
});
