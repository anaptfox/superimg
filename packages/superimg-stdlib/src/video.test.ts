import { describe, expect, it } from "vitest";
import { quantizeVideoTime, sync, VIDEO_SYNC_ATTR } from "./video.js";

describe("std.video.sync", () => {
  it("quantizeVideoTime snaps to frame boundaries", () => {
    expect(quantizeVideoTime(0.0333, 30)).toBeCloseTo(0.0333, 3);
    expect(quantizeVideoTime(0.04, 30)).toBeCloseTo(0.0333, 3);
  });

  it("emits marked video element with data-at", () => {
    const result = sync({ src: "/clip.mp4", at: 1.5, start: 0.2 }, 30);
    expect(result.time).toBeCloseTo(1.7, 2);
    expect(result.html).toContain(VIDEO_SYNC_ATTR);
    expect(result.html).toContain('data-at="');
    expect(result.html).toContain('src="/clip.mp4"');
    expect(result.html).toContain("muted");
    expect(result.html).toContain('crossorigin="anonymous"');
  });
});