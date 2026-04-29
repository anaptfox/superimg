//! useMediaQuery - React hook for media query matching

import { useState, useEffect } from "react";

/**
 * Returns true when the media query matches.
 * Uses 768px as mobile breakpoint (matches Tailwind md).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler(); // initial
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** True when viewport is below 768px (mobile) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
