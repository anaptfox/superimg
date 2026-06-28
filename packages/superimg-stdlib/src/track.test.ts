import { describe, it, expect } from "vitest";
import type { Timeline } from "@superimg/types";
import { createTrack } from "./track.js";

function makeTimeline(seconds: number, durationSeconds = 10): Timeline {
  const progress = seconds / durationSeconds;
  return {
    frame: Math.round(progress * 299),
    fps: 30,
    progress,
    seconds,
    durationSeconds,
    totalFrames: 300,
  };
}

describe("createTrack", () => {
  const words = [
    { text: "hello", start: 0, end: 0.5 },
    { text: "world", start: 0.5, end: 1 },
  ];
  const markers = { intro: 0, outro: 5 };

  it("exposes timeline.seconds", () => {
    const track = createTrack(makeTimeline(2.5), { words, markers });
    expect(track.seconds).toBe(2.5);
  });

  it("delegates transcript sync to cue layer", () => {
    const track = createTrack(makeTimeline(0.2), { words });
    const t = track.transcript();
    expect(t.current()?.text).toBe("hello");
    expect(t.charProgress()).toBeGreaterThan(0);
  });

  it("delegates markers sync to cue layer", () => {
    const track = createTrack(makeTimeline(2), { markers });
    const m = track.markers();
    expect(m.progress("intro", "outro")).toBeGreaterThan(0);
    expect(m.progress("intro", "outro")).toBeLessThanOrEqual(1);
  });

  it("defaults empty words and markers", () => {
    const track = createTrack(makeTimeline(1), {});
    expect(track.transcript().current()).toBeNull();
    expect(() => track.markers().progress("a", "b")).toThrow(/not found/);
  });

  it("seconds updates when timeline changes", () => {
    const track = createTrack(makeTimeline(1), { words });
    expect(track.seconds).toBe(1);
    const track2 = createTrack(makeTimeline(3), { words });
    expect(track2.seconds).toBe(3);
  });
});