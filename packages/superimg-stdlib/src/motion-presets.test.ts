import { describe, expect, it } from "vitest";
import { getMotionTone, motionStyle } from "./motion-presets.js";

describe("motion presets", () => {
  it("returns tone tables", () => {
    const social = getMotionTone("social");
    expect(social.enter.y).toBe(32);
    expect(social.stagger.capMs).toBeLessThanOrEqual(500);
  });

  it("motionStyle merges overrides", () => {
    const s = motionStyle("premium", { y: 40 });
    expect(s.y).toBe(40);
    expect(s.easing).toBe("easeInOutCubic");
  });
});
