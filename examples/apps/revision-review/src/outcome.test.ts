import { describe, expect, it } from "vitest";
import { remainsUncertain, reconciledUncertainty } from "./outcome.js";

describe("revision caller evidence", () => {
  it("preserves unknown after lost or malformed mutation replies", () => {
    expect(remainsUncertain(false, new TypeError("network lost"), true)).toBe(true);
    expect(remainsUncertain(false, new SyntaxError("truncated JSON"), true)).toBe(true);
    expect(remainsUncertain(false, new TypeError("read failed"), false)).toBe(false);
  });
  it("distinguishes a known host rejection from an unknown effect", () => {
    expect(remainsUncertain(false, { hostReported: true }, true)).toBe(false);
    expect(remainsUncertain(false, { hostReported: true, unknown: true }, true)).toBe(true);
    expect(remainsUncertain(true, { hostReported: true }, false)).toBe(true);
  });
  it("only clears uncertainty with reconciled source evidence", () => {
    expect(reconciledUncertainty(true, "not-started")).toBe(true);
    expect(reconciledUncertainty(true, "unexpected")).toBe(true);
    expect(reconciledUncertainty(false, "uncertain")).toBe(true);
    expect(reconciledUncertainty(true, "completed")).toBe(false);
    expect(reconciledUncertainty(true, "not-applied")).toBe(false);
  });
  it("never uses an edit reconciliation to resolve an unknown export", () => {
    expect(reconciledUncertainty(true, "completed", "export")).toBe(true);
  });

});
