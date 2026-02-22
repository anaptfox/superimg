//! Playback controller for animation loop

import type { PlayerStore } from "./state.js";

export interface PlaybackController {
  play(fromFrame?: number): void;
  pause(): void;
  isActive(): boolean;
  destroy(): void;
}

export interface PlaybackCallbacks {
  onFrame: (frame: number) => void;
  onEnd: () => void;
}

/**
 * Creates a playback controller that manages the animation loop.
 * The controller uses requestAnimationFrame for smooth playback.
 */
export function createPlaybackController(
  store: PlayerStore,
  callbacks: PlaybackCallbacks
): PlaybackController {
  let animationFrameId: number | null = null;
  let startTime: number = 0;
  let startFrame: number = 0;

  const tick = () => {
    const state = store.getState();
    if (!state.isPlaying || state.isScrubbing) {
      animationFrameId = null;
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - startTime) / 1000;
    const frameNum = startFrame + Math.floor(elapsed * state.fps);

    if (frameNum >= state.totalFrames) {
      callbacks.onEnd();
      animationFrameId = null;
      return;
    }

    callbacks.onFrame(frameNum);
    animationFrameId = requestAnimationFrame(tick);
  };

  return {
    play(fromFrame?: number) {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      const state = store.getState();
      startFrame = fromFrame ?? state.currentFrame;
      startTime = performance.now();
      animationFrameId = requestAnimationFrame(tick);
    },

    pause() {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    isActive() {
      return animationFrameId !== null;
    },

    destroy() {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
  };
}
