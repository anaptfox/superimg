import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders `children()` only after the component has mounted in the browser.
 *
 * The SuperImg `<Player>` relies on the rolldown-WASM browser bundler and DOM
 * APIs, so it must never execute during server-side rendering. React Router
 * runs in SSR mode by default — this guard keeps the player out of the server
 * render and avoids hydration mismatches.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return <>{mounted ? children() : fallback}</>;
}
