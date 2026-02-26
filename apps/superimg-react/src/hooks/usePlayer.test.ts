import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayer } from "./usePlayer.js";

describe("usePlayer", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    expect(result.current.state.currentFrame).toBe(0);
    expect(result.current.state.totalFrames).toBe(150);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it("play sets isPlaying to true", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    act(() => result.current.play());
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("pause sets isPlaying to false", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it("togglePlayPause toggles isPlaying", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    act(() => result.current.togglePlayPause());
    expect(result.current.state.isPlaying).toBe(true);
    act(() => result.current.togglePlayPause());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it("seek updates currentFrame", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    act(() => result.current.seek(50));
    expect(result.current.state.currentFrame).toBe(50);
  });

  it("updateConfig updates totalFrames", () => {
    const { result } = renderHook(() =>
      usePlayer({ fps: 30, durationSeconds: 5 })
    );
    act(() => result.current.updateConfig({ fps: 60, durationSeconds: 10 }));
    expect(result.current.state.totalFrames).toBe(600);
  });
});
