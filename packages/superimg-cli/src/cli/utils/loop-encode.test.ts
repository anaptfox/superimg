import { describe, expect, it } from "vitest";
import { loopFriendlyEncoding } from "./loop-encode.js";

describe("loopFriendlyEncoding", () => {
  it("is a no-op for once / undefined", () => {
    expect(loopFriendlyEncoding("once", { format: "mp4" })).toEqual({ format: "mp4" });
    expect(loopFriendlyEncoding(undefined, { format: "mp4" })).toEqual({ format: "mp4" });
  });

  it("sets keyFrameInterval for loop when unset", () => {
    const enc = loopFriendlyEncoding("loop", { format: "mp4" });
    expect(enc?.video?.keyFrameInterval).toBe(2);
    expect(enc?.format).toBe("mp4");
  });

  it("preserves explicit keyFrameInterval", () => {
    const enc = loopFriendlyEncoding("loop", {
      video: { keyFrameInterval: 0.5 },
    });
    expect(enc?.video?.keyFrameInterval).toBe(0.5);
  });
});
