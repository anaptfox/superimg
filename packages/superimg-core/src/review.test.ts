import { describe, expect, it } from "vitest";
import { observeBounds, observePresence, observeReviewBeat, evaluateReviewAssertions } from "./review.js";
import type { ReviewObservationContext } from "@superimg/types";

describe("native review observations", () => {
  it("distinguishes containment, outside geometry and unavailable evidence", () => {
    const canvas = { width: 100, height: 80 };
    const check = [{ id: "box", label: "Inside", metric: "box.contained", equals: true }];
    for (const [bounds, status] of [
      [{ x: 0, y: 0, width: 100, height: 80 }, "pass"],
      [{ x: -1, y: 0, width: 100, height: 80 }, "fail"],
      [undefined, "unverified"],
      [{ x: 0, y: 0, width: NaN, height: 80 }, "unverified"],
      [{ x: 0, y: 0, width: -1, height: 80 }, "unverified"],
    ] as const) expect(evaluateReviewAssertions(check, "hold", { box: observeBounds(bounds, canvas) })[0]?.status).toBe(status);
  });
  it("does not turn incomplete or ambiguous identity inventories into facts", () => {
    expect(observePresence([], "title")).toEqual({});
    expect(observePresence([], "title", "complete")).toEqual({ present: false });
    expect(observePresence(["title"], "title")).toEqual({ present: true });
    expect(observePresence(["title", "title"], "title", "complete")).toEqual({});
  });
  it("keeps non-finite, async, deep and oversized UTF-8 observations invalid", () => {
    const context = {} as ReviewObservationContext;
    const base = { schemaVersion: 1 as const, beats: [] };
    expect(observeReviewBeat({ ...base, observe: () => ({ bad: NaN }) }, context).observationError).toMatch(/finite/);
    expect(observeReviewBeat({ ...base, observe: () => ({ large: "🦊".repeat(5000) }) }, context).observationError).toMatch(/bytes/);
    let nested: Record<string, unknown> = {};
    for (let n = 0; n < 15; n++) nested = { child: nested };
    expect(observeReviewBeat({ ...base, observe: () => nested as never }, context).observationError).toMatch(/levels/);
  });
});
