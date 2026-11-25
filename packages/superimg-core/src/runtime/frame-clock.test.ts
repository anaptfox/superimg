import { describe, expect, it } from "vitest";
import { resolveEncodedFrame } from "../shared/frame-clock.js";

describe("encoded still selection", () => {
  it("resolves and records an out-of-range request", () => {
    expect(resolveEncodedFrame(99, 30, 180)).toEqual({ requestedSeconds: 99, frame: 179, encodedSeconds: 179 / 30, clamped: true });
    expect(resolveEncodedFrame(0, 30, 1)).toMatchObject({ frame: 0, encodedSeconds: 0, clamped: false });
    expect(resolveEncodedFrame(4.8, 30, 180)).toMatchObject({ frame: 144, encodedSeconds: 4.8, clamped: false });
  });
  it("rejects invalid clocks", () => {
    expect(() => resolveEncodedFrame(-1, 30, 180)).toThrow();
    expect(() => resolveEncodedFrame(0, 0, 180)).toThrow();
    expect(() => resolveEncodedFrame(0, 30, 0)).toThrow();
  });
});
