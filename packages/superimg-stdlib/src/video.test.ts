import { describe, expect, it } from "vitest";
import { quantizeVideoTime, sync, CLIP_SYNC_ATTR } from "./video.js";

function parseDataAttr(html: string, name: string): string | undefined {
  const match = html.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1];
}

describe("std.video.sync", () => {
  it("quantizeVideoTime snaps to frame boundaries", () => {
    expect(quantizeVideoTime(0.0333, 30)).toBeCloseTo(0.0333, 3);
    expect(quantizeVideoTime(0.04, 30)).toBeCloseTo(0.0333, 3);
  });

  it("quantizeVideoTime is idempotent", () => {
    const samples = [0, 0.03333333333333333, 0.5, 1.7, 3.5, 4.999];
    for (const t of samples) {
      const once = quantizeVideoTime(t, 30);
      expect(quantizeVideoTime(once, 30)).toBe(once);
    }
  });

  it("frameIndex and time stay aligned after sync", () => {
    const fps = 30;
    const result = sync({ src: "/clip.mp4", at: 1.5, start: 0.2 }, fps);
    expect(result.frameIndex).toBe(Math.round(result.time * fps));
    expect(result.time).toBeCloseTo(result.frameIndex / fps, 10);
  });

  it("maps timeline.seconds (frame/fps) to matching frameIndex", () => {
    const fps = 30;
    for (const frame of [0, 1, 15, 30, 60, 119]) {
      const at = frame / fps;
      const result = sync({ src: "/clip.mp4", at }, fps);
      expect(result.time).toBeCloseTo(at, 10);
      expect(result.frameIndex).toBe(frame);
    }
  });

  it("applies start offset and playbackRate before quantization", () => {
    const fps = 30;
    const result = sync({ src: "/clip.mp4", at: 2, start: 0.5, playbackRate: 1.5 }, fps);
    expect(result.time).toBeCloseTo(3.5, 10);
    expect(result.frameIndex).toBe(105);
  });

  it("emits marked img placeholder with data-t and data-frame", () => {
    const result = sync({ src: "/clip.mp4", at: 1.5, start: 0.2 }, 30);
    expect(result.time).toBeCloseTo(1.7, 2);
    expect(result.frameIndex).toBe(Math.round(result.time * 30));
    expect(result.html).toContain(CLIP_SYNC_ATTR);
    expect(result.html).toContain('data-t="');
    expect(result.html).toContain('data-frame="');
    expect(result.html).toContain('data-src="/clip.mp4"');
    expect(result.html).toContain("<img");
    expect(result.html).not.toContain("<video");
    expect(result.html).not.toMatch(/<img[^>]*\ssrc="/);

    expect(Number(parseDataAttr(result.html, "data-t"))).toBeCloseTo(result.time, 10);
    expect(Number(parseDataAttr(result.html, "data-frame"))).toBe(result.frameIndex);
  });

  it("emits pixel dimensions in style for numeric width/height", () => {
    const result = sync({ src: "/clip.mp4", at: 0, width: 640, height: 360 }, 30);
    expect(result.style).toContain("width:640px");
    expect(result.style).toContain("height:360px");
    expect(result.style).toContain("object-fit:cover");
    expect(result.html).toContain(result.style);
  });
});