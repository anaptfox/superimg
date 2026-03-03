//! useSwipeGesture - Touch gesture detection for swipe navigation
//! Supplements native scroll with velocity-based swipe callbacks

import { useEffect, useRef } from "react";

export interface SwipeGestureOptions {
  /** Called on swipe up (scroll down / next) */
  onSwipeUp?: () => void;
  /** Called on swipe down (scroll up / previous) */
  onSwipeDown?: () => void;
  /** Minimum swipe distance in pixels (default: 50) */
  threshold?: number;
  /** Minimum velocity in px/ms (default: 0.3) */
  velocityThreshold?: number;
  /** Whether gestures are enabled (default: true) */
  enabled?: boolean;
}

export function useSwipeGesture(
  elementRef: React.RefObject<HTMLElement | null>,
  options: SwipeGestureOptions
) {
  const {
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
    enabled = true,
  } = options;

  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaY) / deltaTime;

      // Check if swipe meets thresholds
      if (Math.abs(deltaY) >= threshold && velocity >= velocityThreshold) {
        if (deltaY > 0) {
          // Swiped up (finger moved up) → next
          onSwipeUp?.();
        } else {
          // Swiped down (finger moved down) → previous
          onSwipeDown?.();
        }
      }

      touchStartRef.current = null;
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, onSwipeUp, onSwipeDown, threshold, velocityThreshold, enabled]);
}
