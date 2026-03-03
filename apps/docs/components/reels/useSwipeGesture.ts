//! useSwipeGesture - Touch gesture detection for swipe navigation
//! Supplements native scroll with velocity-based swipe callbacks

import { useEffect, useRef } from "react";

export interface SwipeGestureOptions {
  /** Called on swipe up (scroll down / next) */
  onSwipeUp?: () => void;
  /** Called on swipe down (scroll up / previous) */
  onSwipeDown?: () => void;
  /** Called on swipe left (scroll right / next) */
  onSwipeLeft?: () => void;
  /** Called on swipe right (scroll left / previous) */
  onSwipeRight?: () => void;
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
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    velocityThreshold = 0.3,
    enabled = true,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const deltaX = touchStartRef.current.x - e.changedTouches[0].clientX;
      const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Determine if swipe is primarily horizontal or vertical
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      const delta = isHorizontal ? deltaX : deltaY;
      const velocity = Math.abs(delta) / deltaTime;

      // Check if swipe meets thresholds
      if (Math.abs(delta) >= threshold && velocity >= velocityThreshold) {
        if (isHorizontal) {
          // Horizontal swipe
          if (deltaX > 0) {
            // Swiped left (finger moved left) → next
            onSwipeLeft?.();
          } else {
            // Swiped right (finger moved right) → previous
            onSwipeRight?.();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            // Swiped up (finger moved up) → next
            onSwipeUp?.();
          } else {
            // Swiped down (finger moved down) → previous
            onSwipeDown?.();
          }
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
  }, [elementRef, onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight, threshold, velocityThreshold, enabled]);
}
