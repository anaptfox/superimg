"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

interface DeferredDemoProps {
  children: ReactNode;
  label: string;
}

export function DeferredDemo({ children, label }: DeferredDemoProps) {
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
      { rootMargin: "240px 0px" },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={rootRef} className="not-prose my-8 min-h-48">
      {active ? (
        children
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="flex min-h-48 w-full items-center justify-center rounded-xl border border-border/50 bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          Load {label}
        </button>
      )}
    </div>
  );
}
