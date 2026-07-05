import type { RuntimeState, RuntimeStore } from "@superimg/media";
import type { PlayerStore } from "./state.js";
import type { MediaSession } from "@superimg/media";

function buildRuntimeState(
  store: PlayerStore,
  getSession: () => MediaSession | null,
): RuntimeState {
  const s = store.getState();
  const session = getSession()?.getState();
  return {
    medium: session?.medium ?? "html",
    animated: session?.animated ?? s.totalFrames > 1,
    isReady: s.isReady,
    isPlaying: s.isPlaying,
    isScrubbing: s.isScrubbing,
    currentFrame: s.currentFrame,
    totalFrames: s.totalFrames,
    fps: s.fps,
    duration: s.duration,
    width: session?.width ?? 0,
    height: session?.height ?? 0,
    progress: s.totalFrames > 1 ? s.currentFrame / (s.totalFrames - 1) : 0,
  };
}

function runtimeStatesEqual(a: RuntimeState, b: RuntimeState): boolean {
  return (
    a.medium === b.medium &&
    a.animated === b.animated &&
    a.isReady === b.isReady &&
    a.isPlaying === b.isPlaying &&
    a.isScrubbing === b.isScrubbing &&
    a.currentFrame === b.currentFrame &&
    a.totalFrames === b.totalFrames &&
    a.fps === b.fps &&
    a.duration === b.duration &&
    a.width === b.width &&
    a.height === b.height &&
    a.progress === b.progress
  );
}

/** Adapts the Zustand PlayerStore to the RuntimeStore interface used by React controls. */
export function createRuntimeStoreAdapter(
  store: PlayerStore,
  getSession: () => MediaSession | null,
): RuntimeStore {
  let snapshot = buildRuntimeState(store, getSession);

  const refreshSnapshot = (): void => {
    const next = buildRuntimeState(store, getSession);
    if (!runtimeStatesEqual(snapshot, next)) {
      snapshot = next;
    }
  };

  return {
    getState: (): RuntimeState => {
      refreshSnapshot();
      return snapshot;
    },
    subscribe: (listener) =>
      store.subscribe(() => {
        refreshSnapshot();
        listener();
      }),
    play: () => store.getState().play(),
    pause: () => store.getState().pause(),
    togglePlayPause: () => store.getState().togglePlayPause(),
    seekFrame: (frame) => store.getState().setFrame(frame),
    seekProgress: (progress) => {
      const s = store.getState();
      const frame = Math.floor(progress * Math.max(0, s.totalFrames - 1));
      s.setFrame(frame);
    },
  };
}
