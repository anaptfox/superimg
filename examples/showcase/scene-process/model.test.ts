import { describe, expect, it } from "vitest";
import { filmData, sampleProcess } from "./model";

describe("process presentation sampling", () => {
  it("preserves accepted appearance independently from animation progress", () => {
    expect(sampleProcess({ progress: 0.2, stamped: true }).stamped).toBe(true);
    expect(sampleProcess({ progress: 0.9, stamped: false }).stamped).toBe(false);
  });

  it("holds at input, contacts the part, and holds at output", () => {
    expect(sampleProcess(filmData(0)).workpieceX).toBe(110);
    const contact = sampleProcess(filmData(2.4));
    expect(contact.workpieceX).toBe(320);
    expect(contact.toolY + 18).toBe(234);
    expect(contact.stamped).toBe(false);
    const result = sampleProcess(filmData(4.5));
    expect(result.workpieceX).toBe(530);
    expect(result.toolY).toBe(150);
    expect(result.stamped).toBe(true);
  });

  it("reproduces poses after out-of-order seeks", () => {
    const times = [0, 0.8, 1.7, 2.4, 2.5, 3.3, 4.5, 5];
    const expected = new Map(times.map(t => [t, sampleProcess(filmData(t))]));
    for (const time of [5, 2.5, 0.8, 4.5, 0, 3.3, 2.4, 1.7, 2.4]) {
      expect(sampleProcess(filmData(time))).toEqual(expected.get(time));
    }
  });

  it("rejects nonfinite host progress and clamps finite progress", () => {
    for (const progress of [NaN, Infinity, -Infinity]) {
      expect(() => sampleProcess({ progress, stamped: false })).toThrow("finite");
    }
    expect(sampleProcess({ progress: -1, stamped: false }).progress).toBe(0);
    expect(sampleProcess({ progress: 2, stamped: true }).progress).toBe(1);
  });
});
