import { describe, expect, it, vi } from "vitest";
import { MediaClock } from "./clock.js";

describe("MediaClock", () => {
  it("does not rebase or publish an unchanged clock contract", () => {
    let now = 0;
    const clock = new MediaClock({ fps: 10, totalFrames: 100, now: () => now, requestFrame: () => 1, cancelFrame: () => {} });
    clock.play();
    const changed = vi.fn();
    clock.subscribe(changed);
    now = 250;
    clock.configure({ fps: 10, totalFrames: 100, playbackMode: "once" });
    now = 500;
    clock.step();
    expect(clock.getState().currentFrame).toBe(5);
    expect(changed).toHaveBeenCalledOnce();
    clock.dispose();
  });

  it("retains elapsed seconds and the fractional position when fps changes while playing", () => {
    let now = 0;
    const clock = new MediaClock({ fps: 10, totalFrames: 100, now: () => now, requestFrame: () => 1, cancelFrame: () => {} });
    clock.play();
    now = 250;
    clock.step();
    clock.configure({ fps: 20, totalFrames: 200 });
    expect(clock.getState()).toMatchObject({ currentFrame: 5, fps: 20, isPlaying: true });
    now = 300;
    clock.step();
    expect(clock.getState().currentFrame).toBe(6);
    clock.dispose();
  });

  it("retains fractional frame remainder without emitting duplicate frame callbacks", () => {
    let now = 0;
    const onFrame = vi.fn();
    const clock = new MediaClock({ fps: 10, totalFrames: 100, now: () => now,
      requestFrame: () => 1, cancelFrame: () => {}, onFrame });
    clock.play();
    now = 250;
    clock.step();
    clock.configure({ fps: 25, totalFrames: 250 });
    expect(clock.getState().currentFrame).toBe(6);
    onFrame.mockClear();
    now = 260;
    clock.step();
    expect(onFrame).not.toHaveBeenCalled();
    now = 280;
    clock.step();
    expect(onFrame).toHaveBeenCalledExactlyOnceWith(7);
    clock.dispose();
  });

  it("clamps a shortened duration and preserves paused time across fps changes", () => {
    const clock = new MediaClock({ fps: 10, totalFrames: 100, requestFrame: () => 1, cancelFrame: () => {} });
    clock.seekFrame(50);
    clock.configure({ fps: 20, totalFrames: 200 });
    expect(clock.getState()).toMatchObject({ currentFrame: 100, isPlaying: false });
    clock.configure({ totalFrames: 20 });
    expect(clock.getState().currentFrame).toBe(19);
    clock.dispose();
  });

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
