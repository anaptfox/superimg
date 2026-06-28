//! React hook for timeline scrubbing

import {
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { formatTime, type RuntimeStore } from "../../index.browser.js";

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

function positionFromPointerEvent(
  event: PointerEvent,
  container: HTMLElement
): number {
  const rect = container.getBoundingClientRect();
  if (rect.width === 0) return 0;
  return (event.clientX - rect.left) / rect.width;
}

/**
 * Hook for timeline scrubbing functionality.
 * Uses pointer events for mouse, touch, and pen input.
 */
export function useTimeline(
  containerRef: RefObject<HTMLElement | null>,
  store: RuntimeStore
): UseTimelineReturn {
  const isScrubbing = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Sync ref to state (refs don't trigger re-renders when .current changes)
  useLayoutEffect(() => {
    setContainer(containerRef.current);
  });

  const positionToFrame = useCallback((position: number): number => {
    const { totalFrames } = store.getState();
    const clampedPosition = Math.max(0, Math.min(1, position));
    return Math.floor(clampedPosition * (totalFrames - 1));
  }, [store]);

  const startScrub = useCallback((position: number) => {
    const frame = positionToFrame(position);
    isScrubbing.current = true;
    store.seekFrame(frame);
  }, [store, positionToFrame]);

  const scrubTo = useCallback((position: number) => {
    if (!isScrubbing.current) return;
    const frame = positionToFrame(position);
    store.seekFrame(frame);
  }, [store, positionToFrame]);

  const stopScrub = useCallback(() => {
    isScrubbing.current = false;
    activePointerId.current = null;
  }, []);

  // Pointer events for mouse + touch scrubbing
  useEffect(() => {
    if (!container) return;

    const endScrub = (event: PointerEvent) => {
      if (
        activePointerId.current !== null &&
        event.pointerId !== activePointerId.current
      ) {
        return;
      }
      stopScrub();
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.preventDefault();
      activePointerId.current = event.pointerId;
      container.setPointerCapture(event.pointerId);
      startScrub(positionFromPointerEvent(event, container));
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (
        !isScrubbing.current ||
        activePointerId.current !== event.pointerId
      ) {
        return;
      }
      event.preventDefault();
      scrubTo(positionFromPointerEvent(event, container));
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", endScrub);
    container.addEventListener("pointercancel", endScrub);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", endScrub);
      container.removeEventListener("pointercancel", endScrub);
    };
  }, [container, startScrub, scrubTo, stopScrub]);

  return {
    startScrub,
    scrubTo,
    stopScrub,
    formatTime,
  };
}