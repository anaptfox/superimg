//! Hook for checkpoint navigation and state

import { useState, useEffect, useCallback, useMemo, type RefObject } from "react";
import type { Checkpoint } from "superimg";
import type { PlayerRef } from "../components/Player.js";

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
  const [currentFrame, setCurrentFrame] = useState(0);

  // Get player instance
  const player = playerRef.current?.player;

  // Subscribe to store changes for current frame
  useEffect(() => {
    if (!player?.store) return;

    const unsubscribe = player.store.subscribe((state) => {
      setCurrentFrame(state.currentFrame);
    });

    // Initial state
    setCurrentFrame(player.store.getState().currentFrame);

    return () => unsubscribe();
  }, [player]);

  // Update checkpoints when player is ready
  useEffect(() => {
    if (!player?.checkpointResolver) {
      setCheckpoints([]);
      return;
    }

    setCheckpoints(player.getCheckpoints());
  }, [player]);

  // Update current checkpoint based on frame
  useEffect(() => {
    if (!player?.checkpointResolver) {
      setCurrent(undefined);
      return;
    }

    const currentCheckpoint = player.getCurrentCheckpoint();
    setCurrent(currentCheckpoint);
  }, [player, currentFrame]);

  // Navigation actions
  const goTo = useCallback((id: string) => {
    player?.goToCheckpoint(id);
  }, [player]);

  const next = useCallback(() => {
    player?.nextCheckpoint();
  }, [player]);

  const prev = useCallback(() => {
    player?.prevCheckpoint();
  }, [player]);

  const add = useCallback((
    id: string,
    frame?: number,
    options?: { label?: string; metadata?: Record<string, unknown> }
  ) => {
    const checkpoint = player?.addCheckpoint(id, frame, options);
    if (checkpoint) {
      // Refresh checkpoints list
      setCheckpoints(player?.getCheckpoints() ?? []);
    }
    return checkpoint;
  }, [player]);

  const remove = useCallback((id: string) => {
    const result = player?.removeCheckpoint(id) ?? false;
    if (result) {
      // Refresh checkpoints list
      setCheckpoints(player?.getCheckpoints() ?? []);
    }
    return result;
  }, [player]);

  // Compute hasNext/hasPrev
  const hasNext = useMemo(() => {
    if (!player?.checkpointResolver) return false;
    return player.checkpointResolver.getNext(currentFrame) !== undefined;
  }, [player, currentFrame]);

  const hasPrev = useMemo(() => {
    if (!player?.checkpointResolver) return false;
    return player.checkpointResolver.getPrevious(currentFrame) !== undefined;
  }, [player, currentFrame]);

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
