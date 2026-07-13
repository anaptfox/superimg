"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

interface DeferredLandingProps {
  children: ReactNode;
  fallback?: ReactNode;
  minHeight?: number;
}

export function DeferredLanding({ children, fallback, minHeight = 420 }: DeferredLandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active || !rootRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={rootRef} style={{ minHeight: active ? undefined : minHeight }}>
      {active ? children : fallback}
    </div>
  );
}
