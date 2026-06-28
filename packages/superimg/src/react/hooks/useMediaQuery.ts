//! useMediaQuery - React hook for media query matching

import { useSyncExternalStore } from "react";

function subscribe(query: string, onChange: () => void): () => void {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Returns true when the media query matches.
 * Uses useSyncExternalStore for tear-free reads and SSR-safe hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => getSnapshot(query),
    getServerSnapshot
  );
}

/** True when viewport is below 768px (mobile) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}