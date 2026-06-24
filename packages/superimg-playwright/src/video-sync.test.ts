import { describe, it, expect } from "vitest";
import { seekTimeoutMs, loadTimeoutMs } from "./video-sync.js";

describe("video-sync timeouts", () => {
  it("warm seek uses ~1 frame budget", () => {
    expect(seekTimeoutMs(30, true)).toBeLessThanOrEqual(50);
    expect(seekTimeoutMs(30, true)).toBeGreaterThanOrEqual(30);
  });

  it("cold seek stays modest (not 250ms floor)", () => {
    expect(seekTimeoutMs(30, false)).toBeLessThanOrEqual(150);
  });

  it("load timeout allows first metadata fetch", () => {
    expect(loadTimeoutMs()).toBeGreaterThanOrEqual(5000);
  });
});