//! useVisibility - IntersectionObserver hook for detecting active reel
//! Tracks which element is >50% visible in the viewport

import { useEffect, useRef, useCallback, useState } from "react";

export interface UseVisibilityOptions {
  /** Threshold ratio to consider "active" (default: 0.5 = 50%) */
  threshold?: number;
  /** Root element for intersection (default: viewport) */
  root?: Element | null;
}

export interface UseVisibilityReturn {
  /** Ref to attach to the observed element */
  ref: React.RefCallback<HTMLElement>;
  /** Whether this element is currently visible above threshold */
  isVisible: boolean;
  /** Current intersection ratio (0-1) */
  ratio: number;
}

export function useVisibility(
  options: UseVisibilityOptions = {}
): UseVisibilityReturn {
  const { threshold = 0.5, root = null } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [ratio, setRatio] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // Cleanup observer
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Ref callback to attach observer
  const ref = useCallback(
    (element: HTMLElement | null) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      elementRef.current = element;

      if (!element) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setRatio(entry.intersectionRatio);
            setIsVisible(entry.intersectionRatio >= threshold);
          }
        },
        {
          root,
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );

      observerRef.current.observe(element);
    },
    [root, threshold]
  );

  return { ref, isVisible, ratio };
}
