//! React hook for player state management

import { useRef, useCallback, useSyncExternalStore } from "react";
import { createPlayerStore, createPlaybackController } from "superimg/browser";
import type {
  PlayerConfig,
  PlayerState,
  PlayerStore,
  PlayerStoreCallbacks,
} from "superimg/browser";

export interface UsePlayerConfig {
  /** Frames per second */
  fps: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Called when frame changes during playback or scrubbing */
  onFrameChange?: (frame: number) => void;
}

export interface UsePlayerReturn {
  /** Current player state */
  state: PlayerState;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Seek to a specific frame */
  seek: (frame: number) => void;
  /** Update player configuration (fps and/or duration) */
  updateConfig: (config: Partial<PlayerConfig>) => void;
  /** Clear the frame cache */
  clearCache: () => void;
  /** The underlying store (for advanced usage) */
  store: PlayerStore;
}

/**
 * Hook for managing video player state and playback.
 *
 * @example
 * ```tsx
 * const { state, play, pause, seek } = usePlayer({
 *   fps: 30,
 *   durationSeconds: 10,
 *   onFrameChange: (frame) => renderFrame(frame),
 * });
 * ```
 */
export function usePlayer(config: UsePlayerConfig): UsePlayerReturn {
  const configRef = useRef(config);
  configRef.current = config;

  // Create store and playback controller once
  const storeRef = useRef<PlayerStore | null>(null);
  const controllerRef = useRef<ReturnType<typeof createPlaybackController> | null>(null);

  if (!storeRef.current) {
    const callbacks: PlayerStoreCallbacks = {
      onPlay: () => {
        const store = storeRef.current;
        const controller = controllerRef.current;
        if (store && controller) {
          controller.play(store.getState().currentFrame);
        }
      },
      onPause: () => {
        controllerRef.current?.pause();
      },
      onFrameChange: (frame) => {
        configRef.current.onFrameChange?.(frame);
      },
    };

    storeRef.current = createPlayerStore(
      { fps: config.fps, durationSeconds: config.durationSeconds },
      callbacks
    );

    controllerRef.current = createPlaybackController(storeRef.current, {
      onFrame: (frame) => {
        storeRef.current?.getState().setFrame(frame);
      },
      onEnd: () => {
        const store = storeRef.current;
        if (store) {
          store.getState().pause();
          store.getState().setFrame(store.getState().totalFrames - 1);
        }
      },
    });
  }

  // After initialization block, store is guaranteed to exist
  const store = storeRef.current!;

  // Subscribe to store changes
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  const play = useCallback(() => {
    store.getState().play();
  }, [store]);

  const pause = useCallback(() => {
    store.getState().pause();
  }, [store]);

  const togglePlayPause = useCallback(() => {
    store.getState().togglePlayPause();
  }, [store]);

  const seek = useCallback((frame: number) => {
    store.getState().setFrame(frame);
  }, [store]);

  const updateConfig = useCallback((newConfig: Partial<PlayerConfig>) => {
    store.getState().updateConfig(newConfig);
  }, [store]);

  const clearCache = useCallback(() => {
    // No-op, cache is managed by presenter now
  }, []);

  return {
    state,
    play,
    pause,
    togglePlayPause,
    seek,
    updateConfig,
    clearCache,
    store,
  };
}
