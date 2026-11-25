import { describe, expect, it } from "vitest";
import { video } from "@superimg/types";
import { applyDestinationTarget } from "./for-target.js";

function loaded(editions?: { square: { size: { width: number; height: number } } }) {
  return {
    value: video({
      duration: "1s",
      render: () => null as never,
      ...(editions === undefined ? {} : { editions }),
    }),
  };
}

describe("applyDestinationTarget", () => {
  it("selects an edition whose canvas matches the destination", () => {
    const applied = applyDestinationTarget(loaded({ square: { size: { width: 1080, height: 1080 } } }), "instagram-square", undefined);
    expect(applied.edition).toBe("square");
  });

  it("rejects a square destination with no exact edition", () => {
    expect(() => applyDestinationTarget(loaded(), "1080x1080", undefined)).toThrow(/exact-aspect edition/);
  });

  it("overrides a non-square destination onto the authored canvas", () => {
    const applied = applyDestinationTarget(loaded(), "1080x1920", undefined);
    expect(applied.edition).toBeUndefined();
    expect(applied.loaded.value).toMatchObject({ config: { width: 1080, height: 1920 } });
  });

  it("refuses an edition that disagrees with --for", () => {
    expect(() => applyDestinationTarget(
      loaded({ square: { size: { width: 1080, height: 1080 } } }),
      "youtube",
      "square",
    )).toThrow(/1080×1080/);
  });
});
