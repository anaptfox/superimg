import { describe, expect, it } from "vitest";
import { normalizeConversionCopy, type ConversionCopyOptions } from "../media.js";

describe("conversion copy policy", () => {
  it("keeps legacy omission distinct from explicit copy preferences and transcoding", () => {
    expect(normalizeConversionCopy(undefined)).toBeUndefined();
    expect(normalizeConversionCopy(false)).toBe(false);
    const options = { mode: "required", boundaryPolicy: "shrink", boundaryTolerance: Infinity, shiftTolerance: 0 } as const;
    const normalized = normalizeConversionCopy(options);
    expect(normalized).toEqual(options);
    expect(normalized).not.toBe(options);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it.each([
    [true, "options object"],
    [null, "options object"],
    [[], "options object"],
    [{ mode: "forced" }, "preferred or required"],
    [{ boundaryPolicy: "exact" }, "expand or shrink"],
    [{ boundaryTolerance: -1 }, "non-negative"],
    [{ boundaryTolerance: NaN }, "non-negative"],
    [{ boundaryTolerance: "1" }, "non-negative"],
    [{ shiftTolerance: Infinity }, "synchronization"],
    [{ shiftTolerance: 0.1 }, "synchronization"],
    [{ boundaryTolerence: 1 }, "Unsupported"],
  ])("rejects malformed or unsupported policy %j", (value, message) => {
    expect(() => normalizeConversionCopy(value as ConversionCopyOptions)).toThrow(message as string);
  });
});
