import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlayerStore } from "./state.js";
import { createPlaybackController } from "./playback.js";

describe("createPlaybackController", () => {
  let rafId = 0;
  let rafCallbacks: Map<number, () => void> = new Map();
  let now = 0;

  beforeEach(() => {
    rafId = 0;
    rafCallbacks = new Map();
    now = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: () => void) => {
        rafId++;
        rafCallbacks.set(rafId, cb);
        return rafId;
      }
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });
    vi.stubGlobal("performance", {
      now: () => now,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("play starts animation loop", () => {
    const store = createPlayerStore({ fps: 30, durationSeconds: 5 });
    store.getState().play();
    const onFrame = vi.fn();
    const onEnd = vi.fn();
    const ctrl = createPlaybackController(store, { onFrame, onEnd });
    ctrl.play();
    expect(ctrl.isActive()).toBe(true);
    expect(rafCallbacks.size).toBe(1);
    ctrl.destroy();
  });

  it("pause stops animation loop", () => {
    const store = createPlayerStore({ fps: 30, durationSeconds: 5 });
    store.getState().play();
    const ctrl = createPlaybackController(store, {
      onFrame: () => {},
      onEnd: () => {},
    });
    ctrl.play();
    expect(ctrl.isActive()).toBe(true);
    ctrl.pause();
    expect(ctrl.isActive()).toBe(false);
  });

  it("calls onFrame as time advances", () => {
    const store = createPlayerStore({ fps: 30, durationSeconds: 5 });
    store.getState().play();
    const onFrame = vi.fn();
    const onEnd = vi.fn();
    const ctrl = createPlaybackController(store, { onFrame, onEnd });
    ctrl.play(0);
    expect(rafCallbacks.size).toBe(1);
    const tick = rafCallbacks.get(Array.from(rafCallbacks.keys())[0])!;
    now = 1000;
    tick();
    expect(onFrame).toHaveBeenCalledWith(30);
    ctrl.destroy();
  });

  it("calls onEnd when reaching totalFrames", () => {
    const store = createPlayerStore({ fps: 30, durationSeconds: 1 });
    store.getState().play();
    const onFrame = vi.fn();
    const onEnd = vi.fn();
    const ctrl = createPlaybackController(store, { onFrame, onEnd });
    ctrl.play(0);
    const tick = rafCallbacks.get(Array.from(rafCallbacks.keys())[0])!;
    now = 2000;
    tick();
    expect(onEnd).toHaveBeenCalled();
    expect(ctrl.isActive()).toBe(false);
  });

  it("destroy cancels animation", () => {
    const store = createPlayerStore({ fps: 30, durationSeconds: 5 });
    store.getState().play();
    const ctrl = createPlaybackController(store, {
      onFrame: () => {},
      onEnd: () => {},
    });
    ctrl.play();
    ctrl.destroy();
    expect(ctrl.isActive()).toBe(false);
  });
});
