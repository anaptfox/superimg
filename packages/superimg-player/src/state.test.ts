import { describe, it, expect, vi } from "vitest";
import { createPlayerStore } from "./state.js";

describe("createPlayerStore", () => {
  const config = { fps: 30, durationSeconds: 5 };

  it("initializes with correct state", () => {
    const store = createPlayerStore(config);
    const state = store.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.isScrubbing).toBe(false);
    expect(state.isReady).toBe(false);
    expect(state.currentFrame).toBe(0);
    expect(state.totalFrames).toBe(150); // 30 * 5
    expect(state.fps).toBe(30);
    expect(state.durationSeconds).toBe(5);
  });

  it("play sets isPlaying to true", () => {
    const store = createPlayerStore(config);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(true);
  });

  it("pause sets isPlaying to false", () => {
    const store = createPlayerStore(config);
    store.getState().play();
    store.getState().pause();
    expect(store.getState().isPlaying).toBe(false);
  });

  it("togglePlayPause toggles isPlaying", () => {
    const store = createPlayerStore(config);
    expect(store.getState().isPlaying).toBe(false);
    store.getState().togglePlayPause();
    expect(store.getState().isPlaying).toBe(true);
    store.getState().togglePlayPause();
    expect(store.getState().isPlaying).toBe(false);
  });

  it("setFrame updates currentFrame", () => {
    const store = createPlayerStore(config);
    store.getState().setFrame(50);
    expect(store.getState().currentFrame).toBe(50);
  });

  it("setFrame clamps to valid range", () => {
    const store = createPlayerStore(config);
    store.getState().setFrame(-10);
    expect(store.getState().currentFrame).toBe(0);
    store.getState().setFrame(200);
    expect(store.getState().currentFrame).toBe(149); // totalFrames - 1
  });

  it("setReady updates isReady", () => {
    const store = createPlayerStore(config);
    store.getState().setReady(true);
    expect(store.getState().isReady).toBe(true);
    store.getState().setReady(false);
    expect(store.getState().isReady).toBe(false);
  });

  it("invokes onPlay callback", () => {
    const onPlay = vi.fn();
    const store = createPlayerStore(config, { onPlay });
    store.getState().play();
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("invokes onPause callback", () => {
    const onPause = vi.fn();
    const store = createPlayerStore(config, { onPause });
    store.getState().play();
    store.getState().pause();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("invokes onFrameChange when setFrame", () => {
    const onFrameChange = vi.fn();
    const store = createPlayerStore(config, { onFrameChange });
    store.getState().setFrame(42);
    expect(onFrameChange).toHaveBeenCalledWith(42);
  });

  it("startScrubbing sets isScrubbing and pauses if playing", () => {
    const onPause = vi.fn();
    const store = createPlayerStore(config, { onPause });
    store.getState().play();
    store.getState().startScrubbing(10);
    expect(store.getState().isScrubbing).toBe(true);
    expect(store.getState().currentFrame).toBe(10);
    expect(onPause).toHaveBeenCalled();
  });

  it("scrubTo only works when scrubbing", () => {
    const store = createPlayerStore(config);
    store.getState().setFrame(20);
    store.getState().scrubTo(30);
    expect(store.getState().currentFrame).toBe(20);
    store.getState().startScrubbing(20);
    store.getState().scrubTo(30);
    expect(store.getState().currentFrame).toBe(30);
  });

  it("stopScrubbing clears isScrubbing", () => {
    const store = createPlayerStore(config);
    store.getState().startScrubbing(10);
    store.getState().stopScrubbing();
    expect(store.getState().isScrubbing).toBe(false);
  });

  it("updateConfig updates fps and totalFrames", () => {
    const store = createPlayerStore(config);
    store.getState().updateConfig({ fps: 60, durationSeconds: 10 });
    expect(store.getState().fps).toBe(60);
    expect(store.getState().durationSeconds).toBe(10);
    expect(store.getState().totalFrames).toBe(600);
  });

  it("play resets to frame 0 when at end", () => {
    const store = createPlayerStore(config);
    store.getState().setFrame(149);
    store.getState().play();
    expect(store.getState().currentFrame).toBe(0);
  });

  it("play does not reset when not at end", () => {
    const store = createPlayerStore(config);
    store.getState().setFrame(50);
    store.getState().play();
    expect(store.getState().currentFrame).toBe(50);
  });

  it("play does nothing when scrubbing", () => {
    const store = createPlayerStore(config);
    store.getState().startScrubbing(10);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(false);
  });
});
