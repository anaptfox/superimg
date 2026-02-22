//! Player state management using Zustand
//! Provides reactive state store for playback, scrubbing, and checkpoint navigation

import { createStore } from "zustand/vanilla";
import type { Checkpoint } from "@superimg/types";
import type { CheckpointResolver } from "@superimg/core";

// =============================================================================
// PLAYER CONFIG
// =============================================================================

export interface PlayerConfig {
  fps: number;
  durationSeconds: number;
}

// =============================================================================
// PLAYER STATE
// =============================================================================

export interface PlayerState {
  // State
  isPlaying: boolean;
  isScrubbing: boolean;
  isReady: boolean;
  currentFrame: number;
  totalFrames: number;
  frameCache: Map<number, ImageData>;
  fps: number;
  durationSeconds: number;
  
  // Actions
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setFrame: (frame: number) => void;
  setReady: (ready: boolean) => void;
  startScrubbing: (frame: number) => void;
  scrubTo: (frame: number) => void;
  stopScrubbing: () => void;
  clearCache: () => void;
  updateConfig: (newConfig: Partial<PlayerConfig>) => void;
  
  // Checkpoint navigation (optional, only if checkpoints exist)
  goToCheckpoint?: (id: string) => void;
  goToNextCheckpoint?: () => void;
  goToPreviousCheckpoint?: () => void;
  getCurrentCheckpoint?: () => Checkpoint | undefined;
}

// =============================================================================
// PLAYER STORE
// =============================================================================

export type PlayerStore = ReturnType<typeof createPlayerStore>;

export interface PlayerStoreCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onFrameChange?: (frame: number) => void;
  onCheckpoint?: (checkpoint: Checkpoint) => void;
  maxCacheSize?: number;
}

export function createPlayerStore(
  config: PlayerConfig,
  callbacks?: PlayerStoreCallbacks,
  checkpointResolver?: CheckpointResolver
) {
  const maxCacheSize = callbacks?.maxCacheSize ?? 30;

  return createStore<PlayerState>((set, get) => ({
    // Initial state
    isPlaying: false,
    isScrubbing: false,
    isReady: false,
    currentFrame: 0,
    totalFrames: Math.floor(config.fps * config.durationSeconds),
    frameCache: new Map(),

    // Config
    fps: config.fps,
    durationSeconds: config.durationSeconds,

    // Actions
    play: () => {
      const { isScrubbing, currentFrame, totalFrames } = get();
      if (isScrubbing) return;
      const frame = currentFrame >= totalFrames - 1 ? 0 : currentFrame;
      set({ isPlaying: true, currentFrame: frame });
      callbacks?.onPlay?.();
    },

    pause: () => {
      set({ isPlaying: false });
      callbacks?.onPause?.();
    },

    togglePlayPause: () => {
      get().isPlaying ? get().pause() : get().play();
    },

    setFrame: (frame: number) => {
      const { totalFrames } = get();
      const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));
      set({ currentFrame: clampedFrame });
      callbacks?.onFrameChange?.(clampedFrame);
    },

    setReady: (ready: boolean) => {
      set({ isReady: ready });
    },

    startScrubbing: (frame: number) => {
      const { isPlaying, totalFrames } = get();
      if (isPlaying) get().pause();
      const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));
      set({ isScrubbing: true, currentFrame: clampedFrame });
      callbacks?.onFrameChange?.(clampedFrame);
    },

    scrubTo: (frame: number) => {
      const { isScrubbing, totalFrames } = get();
      if (!isScrubbing) return;
      const clampedFrame = Math.max(0, Math.min(frame, totalFrames - 1));
      set({ currentFrame: clampedFrame });
      callbacks?.onFrameChange?.(clampedFrame);
    },

    stopScrubbing: () => set({ isScrubbing: false }),

    clearCache: () => {
      get().frameCache.clear();
    },

    updateConfig: (newConfig: Partial<PlayerConfig>) => {
      const current = get();
      const fps = newConfig.fps ?? current.fps;
      const durationSeconds = newConfig.durationSeconds ?? current.durationSeconds;

      get().frameCache.clear();
      set({
        fps,
        durationSeconds,
        totalFrames: Math.floor(fps * durationSeconds),
      });
    },

    // Checkpoint actions (only available if checkpointResolver is provided)
    goToCheckpoint: checkpointResolver
      ? (id: string) => {
          const checkpoint = checkpointResolver.get(id);
          if (checkpoint) {
            get().setFrame(checkpoint.frame);
            callbacks?.onCheckpoint?.(checkpoint);
          }
        }
      : undefined,

    goToNextCheckpoint: checkpointResolver
      ? () => {
          const { currentFrame } = get();
          const next = checkpointResolver.getNext(currentFrame);
          if (next) {
            get().setFrame(next.frame);
            callbacks?.onCheckpoint?.(next);
          }
        }
      : undefined,

    goToPreviousCheckpoint: checkpointResolver
      ? () => {
          const { currentFrame } = get();
          const prev = checkpointResolver.getPrevious(currentFrame);
          if (prev) {
            get().setFrame(prev.frame);
            callbacks?.onCheckpoint?.(prev);
          }
        }
      : undefined,

    getCurrentCheckpoint: checkpointResolver
      ? () => {
          return checkpointResolver.getAt(get().currentFrame);
        }
      : undefined,
  }));
}
