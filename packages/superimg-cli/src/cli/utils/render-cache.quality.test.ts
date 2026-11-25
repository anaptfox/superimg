import { describe, it, expect } from "vitest";
import { computeRenderKey } from "./render-cache.js";

describe("computeRenderKey includes capture/still", () => {
  it("changes when dpr differs", () => {
    const a = computeRenderKey({
      format: "png",
      encoding: { format: "png", capture: { dpr: 2 } },
    });
    const b = computeRenderKey({
      format: "png",
      encoding: { format: "png", capture: { dpr: 1 } },
    });
    expect(a).not.toBe(b);
  });

  it("changes when still.lossless differs", () => {
    const a = computeRenderKey({
      format: "webp",
      encoding: { format: "webp", still: { lossless: true } },
    });
    const b = computeRenderKey({
      format: "webp",
      encoding: { format: "webp", still: { lossless: false } },
    });
    expect(a).not.toBe(b);
  });
});
