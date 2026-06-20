//! React hook for lightweight playback state

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { RuntimeState, RuntimeStore } from "../../index.browser.js";

export interface UsePlayerConfig {
  /** Frames per second */
  fps: number;
  /** Duration in seconds */
  duration: number;
  /** Called when frame changes during playback or scrubbing */
  onFrameChange?: (frame: number) => void;
}

export interface UsePlayerReturn {
  /** Current player state */
  state: RuntimeState;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Seek to a specific frame */
  seek: (frame: number) => void;
  /** Update player configuration (fps and/or duration) */
  updateConfig: (config: Partial<Pick<RuntimeState, "fps" | "duration">>) => void;
  /** Clear the frame cache */
  clearCache: () => void;
  /** The underlying runtime-compatible store */
  store: RuntimeStore;
}

type Listener = () => void;

function createInitialState(fps: number, duration: number): RuntimeState {
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  return {
    kind: "video",
    isReady: true,
    isPlaying: false,
    isScrubbing: false,
    currentFrame: 0,
    totalFrames,
    fps,
    duration,
    width: 0,
    height: 0,
    progress: 0,
  };
}

function withFrame(state: RuntimeState, frame: number): RuntimeState {
  const currentFrame = Math.max(0, Math.min(Math.floor(frame), state.totalFrames - 1));
  return {
    ...state,
    currentFrame,
    progress: state.totalFrames > 1 ? currentFrame / (state.totalFrames - 1) : 0,
  };
}

export function usePlayer(config: UsePlayerConfig): UsePlayerReturn {
  const configRef = useRef(config);
  configRef.current = config;

  const stateRef = useRef<RuntimeState>(createInitialState(config.fps, config.duration));
  const listenersRef = useRef(new Set<Listener>());
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const startFrameRef = useRef(0);
  const storeRef = useRef<RuntimeStore | null>(null);

  const emit = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const setState = useCallback((next: RuntimeState) => {
    stateRef.current = next;
    emit();
  }, [emit]);

  const setFrame = useCallback((frame: number) => {
    const next = withFrame(stateRef.current, frame);
    stateRef.current = next;
    configRef.current.onFrameChange?.(next.currentFrame);
    emit();
  }, [emit]);

  const pauseInternal = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (stateRef.current.isPlaying) {
      setState({ ...stateRef.current, isPlaying: false });
    }
  }, [setState]);

  const tick = useCallback(() => {
    if (!stateRef.current.isPlaying) {
      rafRef.current = null;
      return;
    }
    const elapsedSeconds = (performance.now() - startedAtRef.current) / 1000;
    const nextFrame = startFrameRef.current + Math.floor(elapsedSeconds * stateRef.current.fps);
    if (nextFrame >= stateRef.current.totalFrames) {
      setFrame(stateRef.current.totalFrames - 1);
      pauseInternal();
      return;
    }
    setFrame(nextFrame);
    rafRef.current = requestAnimationFrame(tick);
  }, [pauseInternal, setFrame]);

  if (!storeRef.current) {
    storeRef.current = {
      getState: () => stateRef.current,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
      play: () => {
        if (stateRef.current.isPlaying) return;
        startedAtRef.current = performance.now();
        startFrameRef.current =
          stateRef.current.currentFrame >= stateRef.current.totalFrames - 1
            ? 0
            : stateRef.current.currentFrame;
        setState({ ...withFrame(stateRef.current, startFrameRef.current), isPlaying: true });
        rafRef.current = requestAnimationFrame(tick);
      },
      pause: pauseInternal,
      togglePlayPause: () => {
        stateRef.current.isPlaying ? pauseInternal() : storeRef.current?.play();
      },
      seekFrame: setFrame,
      seekProgress: (progress) => {
        const clamped = Math.max(0, Math.min(1, progress));
        setFrame(Math.floor(clamped * Math.max(0, stateRef.current.totalFrames - 1)));
      },
    };
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const updateConfig = useCallback(
    (nextConfig: Partial<Pick<RuntimeState, "fps" | "duration">>) => {
      const fps = nextConfig.fps ?? stateRef.current.fps;
      const duration = nextConfig.duration ?? stateRef.current.duration;
      const totalFrames = Math.max(1, Math.ceil(duration * fps));
      const next = withFrame(
        {
          ...stateRef.current,
          fps,
          duration,
          totalFrames,
        },
        stateRef.current.currentFrame
      );
      setState(next);
    },
    [setState]
  );

  const clearCache = useCallback(() => {
    // Preview rendering is runtime-owned in vNext; no frame cache is maintained here.
  }, []);

  return {
    state,
    play: store.play,
    pause: store.pause,
    togglePlayPause: store.togglePlayPause,
    seek: store.seekFrame,
    updateConfig,
    clearCache,
    store,
  };
}
