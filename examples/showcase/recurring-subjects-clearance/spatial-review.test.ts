import { describe, expect, it } from "vitest";
import { sampleMorning } from "./model";
import { ORIGINAL_SPOON_POSE } from "./spatial-data";
import { boundsDistanceLowerBound, evaluateClearance, observeSpace, placeBounds, spatialParts, type Bounds } from "./spatial-review";

const unit: Bounds = { min: [0, 0, 0], max: [1, 1, 1] };
describe("authored spatial clearance observations", () => {
  it("measures a conservative separation and preserves evidence limits for overlap", () => {
    expect(boundsDistanceLowerBound(unit, { min: [4, 5, 0], max: [5, 6, 1] })).toBe(5);
    const rule = [{ id: "gap", between: ["a", "b"] as const, minimumCm: .8 }];
    const scan = (bounds: Bounds) => evaluateClearance([{ id: "a/body", entityId: "a", bounds: unit }, { id: "b/body", entityId: "b", bounds }], rule)[0]!;
    expect(scan({ min: [1.8, 0, 0], max: [2.8, 1, 1] }).status).toBe("clear");
    expect(scan({ min: [1.4, 0, 0], max: [2.4, 1, 1] }).status).toBe("clearance-unverified");
    expect(scan(unit)).toMatchObject({ status: "possible-intersection", evidence: "declared-part-aabb", distanceLowerBoundCm: 0 });
    expect(scan(unit).status).not.toBe("mesh-intersection");
  });
  it("transforms rotated bounds in the rendered Euler order", () => {
    const result = placeBounds({ min: [0, 0, 0], max: [2, 1, 4] }, [10, 20, 30], 0, Math.PI / 2);
    expect(result.min[0]).toBeCloseTo(10); expect(result.max[0]).toBeCloseTo(14);
    expect(result.min[2]).toBeCloseTo(28); expect(result.max[2]).toBeCloseTo(30);
    expect(() => placeBounds(unit, [0, NaN, 0], 0, 0)).toThrow();
  });
  it("reports missing geometry as unverified rather than clear", () => {
    expect(evaluateClearance([])[0]).toMatchObject({ status: "unverified", evidence: "missing-proxy", distanceLowerBoundCm: null });
    expect(() => evaluateClearance([{ id: "a", entityId: "a", bounds: unit }, { id: "a", entityId: "a", bounds: unit }])).toThrow("Duplicate");
  });
  it("retains the original failure: the spoon handle overlaps the mug's base envelope", () => {
    for (const seconds of [0, 2, 7, 11]) {
      const result = observeSpace(sampleMorning(seconds), ORIGINAL_SPOON_POSE);
      expect(result.warnings).toContainEqual(expect.objectContaining({ ruleId: "breakfast-spoon-clearance", status: "possible-intersection" }));
      expect(result.minimumClearanceCm).toBe(0);
    }
  });
  it("keeps the repaired spoon clear at every encoded frame in both editions", () => {
    let minimum = Infinity;
    for (const square of [false, true]) for (let frame = 0; frame < 288; frame++) {
      const current = sampleMorning(frame / 287 * 12, square), result = observeSpace(current);
      minimum = Math.min(minimum, result.minimumClearanceCm);
      expect(result.warnings, `frame ${frame}`).toEqual([]);
      expect(current.spoon.entityId).toBe("spoon");
      expect(result.minimumClearanceCm).toBeGreaterThanOrEqual(.8);
    }
    expect(minimum).toBeGreaterThan(.8);
  });
  it("is seek-order independent and emits portable findings with limiting part ids", () => {
    const expected = observeSpace(sampleMorning(7)); observeSpace(sampleMorning(2));
    expect(observeSpace(sampleMorning(7))).toEqual(expected);
    const old = observeSpace(sampleMorning(2), ORIGINAL_SPOON_POSE);
    expect(JSON.parse(JSON.stringify(old))).toEqual(old);
    expect(old.warnings[0]!.limitingParts[0]).toBe("breakfast/body");
    const stemOnly = spatialParts(sampleMorning(2), ORIGINAL_SPOON_POSE).filter(p => p.id !== "spoon/bowl");
    expect(evaluateClearance(stemOnly)[0]!.limitingParts).toContain("spoon/stem");
  });
});
