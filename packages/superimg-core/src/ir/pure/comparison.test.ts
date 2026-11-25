import { describe, expect, it } from "vitest";
import { shouldFailMediaDiff } from "./comparison.js";
import { classifyExpectedChanges } from "./change-selectors.js";
import { diffSemantics } from "./semantic-diff.js";
import type { MediaIRDiff } from "@superimg/types";

describe("shared comparison operations", () => {
  it("preserves category filtering independently of CLI exit handling", () => {
    const diff = { result: "mediaAffecting", changes: [{ category: "motion" }] } as MediaIRDiff;
    expect(shouldFailMediaDiff(diff, "motion")).toBe(true);
    expect(shouldFailMediaDiff(diff, "content")).toBe(false);
    expect(shouldFailMediaDiff(diff, "any")).toBe(true);
    expect(shouldFailMediaDiff(diff, "none")).toBe(false);
  });
  it("reports unexpected changes and unmatched expectations", () => {
    expect(classifyExpectedChanges(["motion/default::title.enter", "node/default::extra"], ["motion:title.*", "missing"]))
      .toEqual({ matched: ["motion/default::title.enter"], unexpected: ["node/default::extra"], missing: ["missing"] });
  });
  it("retains object identity and geometry deltas", () => {
    const result = diffSemantics(0, 1,
      { text: ["A"], colors: [], eqKeys: [], nodes: [{ id: "card", tag: "Frame", layout: { x: 0, y: 0, width: 100, height: 40 } }] },
      { text: ["B"], colors: [], eqKeys: [], nodes: [{ id: "card", tag: "Frame", layout: { x: 10, y: 0, width: 120, height: 40 } }] });
    expect(result.addedText).toEqual(["B"]);
    expect(result.removedText).toEqual(["A"]);
    expect(result.changedNodes).toEqual([{ id: "card", fields: ["layout"] }]);
    expect(result.boxDeltas[0]).toMatchObject({ id: "card", dx: 10, dw: 20 });
  });
});
