//! Helpers for subscribing to PlayerRef-backed runtime stores (React useSyncExternalStore)

import type { RefObject } from "react";
import type { RuntimeState } from "../../index.browser.js";
import type { PlayerRef } from "../components/Player.js";

const EMPTY_STATE: RuntimeState = {
  medium: "html",
  animated: true,
  isReady: false,
  isPlaying: false,
  isScrubbing: false,
  currentFrame: 0,
  totalFrames: 1,
  fps: 30,
  duration: 0,
  width: 0,
  height: 0,
  progress: 0,
};

export function getEmptyPlayerState(): RuntimeState {
  return EMPTY_STATE;
}

/**
 * Subscribe to a PlayerRef's runtime store once it becomes available.
 * Polls with rAF until the ref is populated (player loads asynchronously).
 */
export function subscribeToPlayerRefStore(
  playerRef: RefObject<PlayerRef | null>,
  onStoreChange: () => void
): () => void {
  let storeUnsub: (() => void) | undefined;
  let rafId = 0;
  let attachedStore = playerRef.current?.store ?? null;

  const attach = () => {
    const store = playerRef.current?.store ?? null;
    if (store === attachedStore) {
      if (!store) {
        rafId = requestAnimationFrame(attach);
      }
      return;
    }

    storeUnsub?.();
    storeUnsub = undefined;
    attachedStore = store;

    if (store) {
      storeUnsub = store.subscribe(onStoreChange);
      onStoreChange();
      return;
    }

    rafId = requestAnimationFrame(attach);
  };

  attach();

  return () => {
    cancelAnimationFrame(rafId);
    storeUnsub?.();
  };
}

export function getPlayerRefStateSnapshot(
  playerRef: RefObject<PlayerRef | null>
): RuntimeState {
  return playerRef.current?.store?.getState() ?? EMPTY_STATE;
}