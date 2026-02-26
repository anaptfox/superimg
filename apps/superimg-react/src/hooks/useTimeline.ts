//! React hook for timeline scrubbing

import { useEffect, useCallback, useRef, type RefObject } from "react";
import { formatTime, type PlayerStore } from "superimg/browser";

export interface UseTimelineReturn {
  /** Start scrubbing at a position (0-1) */
  startScrub: (position: number) => void;
  /** Continue scrubbing to a position (0-1) */
  scrubTo: (position: number) => void;
  /** Stop scrubbing */
  stopScrub: () => void;
  /** Format seconds as MM:SS */
  formatTime: (seconds: number) => string;
}

/**
 * Hook for timeline scrubbing functionality.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { player } = usePlayer(config);
 * const { startScrub, scrubTo, stopScrub } = useTimeline(containerRef, player.store);
 *
 * // In your Timeline component, attach mouse handlers
 * const handleMouseDown = (e: MouseEvent) => {
 *   const rect = containerRef.current.getBoundingClientRect();
 *   const position = (e.clientX - rect.left) / rect.width;
 *   startScrub(position);
 * };
 * ```
 */
export function useTimeline(
  containerRef: RefObject<HTMLElement | null>,
  store: PlayerStore
): UseTimelineReturn {
  const isScrubbing = useRef(false);

  const positionToFrame = useCallback((position: number): number => {
    const { totalFrames } = store.getState();
    const clampedPosition = Math.max(0, Math.min(1, position));
    return Math.floor(clampedPosition * (totalFrames - 1));
  }, [store]);

  const startScrub = useCallback((position: number) => {
    const frame = positionToFrame(position);
    isScrubbing.current = true;
    store.getState().startScrubbing(frame);
  }, [store, positionToFrame]);

  const scrubTo = useCallback((position: number) => {
    if (!isScrubbing.current) return;
    const frame = positionToFrame(position);
    store.getState().scrubTo(frame);
  }, [store, positionToFrame]);

  const stopScrub = useCallback(() => {
    isScrubbing.current = false;
    store.getState().stopScrubbing();
  }, [store]);

  // Set up mouse event handlers on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      startScrub(position);

      const handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const position = (e.clientX - rect.left) / rect.width;
        scrubTo(position);
      };

      const handleMouseUp = () => {
        stopScrub();
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    container.addEventListener("mousedown", handleMouseDown);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef.current, startScrub, scrubTo, stopScrub]);

  return {
    startScrub,
    scrubTo,
    stopScrub,
    formatTime,
  };
}
