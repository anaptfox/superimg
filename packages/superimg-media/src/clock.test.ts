import { describe, expect, it, vi } from "vitest";
import { MediaClock } from "./clock.js";

describe("MediaClock", () => {
  it("plays, pauses, and emits frame changes", () => {
    let now = 0;
    const frames: number[] = [];
    const clock = new MediaClock({
      fps: 10,
      totalFrames: 10,
      now: () => now,
      requestFrame: () => 1,
      cancelFrame: () => {},
      onFrame: (frame) => frames.push(frame),
    });

    clock.play();
    now = 250;
    clock.step(now);

    expect(clock.getState().isPlaying).toBe(true);
    expect(clock.getState().currentFrame).toBe(2);
    expect(frames).toContain(2);

    clock.pause();
    expect(clock.getState().isPlaying).toBe(false);
  });

  it("lands on the final frame before ending", () => {
    let now = 0;
    const ended = vi.fn();
    const frames: number[] = [];
    const clock = new MediaClock({
      fps: 10,
      totalFrames: 5,
      now: () => now,
      requestFrame: () => 1,
      cancelFrame: () => {},
      onFrame: (frame) => frames.push(frame),
      onEnded: ended,
    });

    clock.play();
    now = 600;
    clock.step(now);

    expect(clock.getState().isPlaying).toBe(false);
    expect(clock.getState().currentFrame).toBe(4);
    expect(frames.at(-1)).toBe(4);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("loops from the beginning in loop mode", () => {
    let now = 0;
    const frames: number[] = [];
    const clock = new MediaClock({
      fps: 10,
      totalFrames: 5,
      playbackMode: "loop",
      now: () => now,
      requestFrame: () => 1,
      cancelFrame: () => {},
      onFrame: (frame) => frames.push(frame),
    });

    clock.play();
    now = 600;
    clock.step(now);

    expect(clock.getState().isPlaying).toBe(true);
    expect(clock.getState().currentFrame).toBe(0);
    expect(frames.at(-1)).toBe(0);
  });

  it("seeks by frame and progress", () => {
    const clock = new MediaClock({
      fps: 30,
      totalFrames: 61,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });

    clock.seekFrame(999);
    expect(clock.getState().currentFrame).toBe(60);

    clock.seekProgress(0.5);
    expect(clock.getState().currentFrame).toBe(30);
  });
});
