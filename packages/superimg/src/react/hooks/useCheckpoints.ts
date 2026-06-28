//! Hook for checkpoint navigation and state

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, type RefObject } from "react";
import type { Checkpoint } from "../../index.browser.js";
import type { PlayerRef } from "../components/Player.js";
import {
  getPlayerRefStateSnapshot,
  subscribeToPlayerRefStore,
} from "../utils/subscribeToPlayerRef.js";

export interface UseCheckpointsReturn {
  /** All checkpoints sorted by frame */
  checkpoints: Checkpoint[];
  /** Current checkpoint (at or before current frame) */
  current: Checkpoint | undefined;
  /** Navigate to a checkpoint by ID */
  goTo: (id: string) => void;
  /** Navigate to next checkpoint */
  next: () => void;
  /** Navigate to previous checkpoint */
  prev: () => void;
  /** Whether there is a next checkpoint */
  hasNext: boolean;
  /** Whether there is a previous checkpoint */
  hasPrev: boolean;
  /** Add a checkpoint at runtime */
  add: (id: string, frame?: number, options?: { label?: string; metadata?: Record<string, unknown> }) => Checkpoint | undefined;
  /** Remove a runtime checkpoint */
  remove: (id: string) => boolean;
}

/**
 * Hook for checkpoint navigation and state management.
 *
 * @example
 * ```tsx
 * const playerRef = useRef<PlayerRef>(null);
 * const { checkpoints, current, goTo, next, prev, hasNext, hasPrev } = useCheckpoints(playerRef);
 *
 * return (
 *   <div>
 *     <Player ref={playerRef} input={templateCode} />
 *     <select value={current?.id} onChange={(e) => goTo(e.target.value)}>
 *       {checkpoints.map((cp) => (
 *         <option key={cp.id} value={cp.id}>{cp.label}</option>
 *       ))}
 *     </select>
 *     <button onClick={prev} disabled={!hasPrev}>←</button>
 *     <button onClick={next} disabled={!hasNext}>→</button>
 *   </div>
 * );
 * ```
 */
export function useCheckpoints(playerRef: RefObject<PlayerRef | null>): UseCheckpointsReturn {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [current, setCurrent] = useState<Checkpoint | undefined>(undefined);

  // Reactive frame + readiness via PlayerRef store (useSyncExternalStore)
  const playerState = useSyncExternalStore(
    (onChange) => subscribeToPlayerRefStore(playerRef, onChange),
    () => getPlayerRefStateSnapshot(playerRef),
    () => getPlayerRefStateSnapshot(playerRef)
  );

  const player = playerRef.current?.player;
  const currentFrame = playerState.currentFrame;

  // Update checkpoints when player is ready
  useEffect(() => {
    if (!player?.checkpointResolver) {
      setCheckpoints([]);
      return;
    }

    setCheckpoints(player.getCheckpoints());
  }, [player, playerState.isReady]);

  // Update current checkpoint based on frame
  useEffect(() => {
    if (!player?.checkpointResolver) {
      setCurrent(undefined);
      return;
    }

    setCurrent(player.getCurrentCheckpoint());
  }, [player, currentFrame, playerState.isReady]);

  // Navigation actions
  const goTo = useCallback((id: string) => {
    playerRef.current?.player?.goToCheckpoint(id);
  }, [playerRef]);

  const next = useCallback(() => {
    playerRef.current?.player?.nextCheckpoint();
  }, [playerRef]);

  const prev = useCallback(() => {
    playerRef.current?.player?.prevCheckpoint();
  }, [playerRef]);

  const add = useCallback((
    id: string,
    frame?: number,
    options?: { label?: string; metadata?: Record<string, unknown> }
  ) => {
    const activePlayer = playerRef.current?.player;
    const checkpoint = activePlayer?.addCheckpoint(id, frame, options);
    if (checkpoint) {
      setCheckpoints(activePlayer?.getCheckpoints() ?? []);
    }
    return checkpoint;
  }, [playerRef]);

  const remove = useCallback((id: string) => {
    const activePlayer = playerRef.current?.player;
    const result = activePlayer?.removeCheckpoint(id) ?? false;
    if (result) {
      setCheckpoints(activePlayer?.getCheckpoints() ?? []);
    }
    return result;
  }, [playerRef]);

  // Compute hasNext/hasPrev
  const hasNext = useMemo(() => {
    const resolver = playerRef.current?.player?.checkpointResolver;
    if (!resolver) return false;
    return resolver.getNext(currentFrame) !== undefined;
  }, [playerRef, currentFrame, playerState.isReady]);

  const hasPrev = useMemo(() => {
    const resolver = playerRef.current?.player?.checkpointResolver;
    if (!resolver) return false;
    return resolver.getPrevious(currentFrame) !== undefined;
  }, [playerRef, currentFrame, playerState.isReady]);

  return {
    checkpoints,
    current,
    goTo,
    next,
    prev,
    hasNext,
    hasPrev,
    add,
    remove,
  };
}