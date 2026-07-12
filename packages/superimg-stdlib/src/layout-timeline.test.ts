import { describe, it, expect } from "vitest";
import { layoutTimeline } from "./layout-timeline.js";

describe("layoutTimeline", () => {
  it("sums percent phases to ~100% and preserves order", () => {
    const { phases, totalSeconds, order } = layoutTimeline({
      boot: 1,
      type: 2,
      event_0: 1,
    });
    expect(totalSeconds).toBe(4);
    expect(order).toEqual(["boot", "type", "event_0"]);
    const sum = Object.values(phases).reduce((a, p) => a + parseFloat(p), 0);
    expect(sum).toBeCloseTo(100, 5);
    expect(phases.boot).toBe("25%");
    expect(phases.type).toBe("50%");
    expect(phases.event_0).toBe("25%");
  });

  it("handles a single segment", () => {
    const { phases, totalSeconds, order } = layoutTimeline({ main: 3.5 });
    expect(totalSeconds).toBe(3.5);
    expect(order).toEqual(["main"]);
    expect(phases.main).toBe("100%");
  });

  it("throws on empty segments", () => {
    expect(() => layoutTimeline({})).toThrow(/at least one phase/);
  });

  it("throws on non-positive segment", () => {
    expect(() => layoutTimeline({ a: 1, b: 0 })).toThrow(/b/);
    expect(() => layoutTimeline({ a: -1 })).toThrow(/a/);
    expect(() => layoutTimeline({ a: NaN })).toThrow(/a/);
  });

  it("scales uneven event lengths", () => {
    const ok = layoutTimeline({ intro: 1, long: 9, outro: 1 });
    expect(ok.totalSeconds).toBe(11);
    expect(parseFloat(ok.phases.long!)).toBeCloseTo((9 / 11) * 100, 5);
  });
});
