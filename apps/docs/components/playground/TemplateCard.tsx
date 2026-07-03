"use client";

import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { Player, type PlayerRef } from "superimg/react";
import type { EditorExample } from "@/lib/video/examples";
import { usePlaygroundExample } from "@/lib/playground/example";
import { useIsMobile } from "@/hooks/use-mobile";

interface TemplateCardProps {
  example: EditorExample;
  onSelect?: (example: EditorExample) => void;
}

export function TemplateCard({ example, onSelect }: TemplateCardProps) {
  const playerRef = useRef<PlayerRef>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const [isHovering, setIsHovering] = useState(false);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const {
    template,
    assets,
    assetResolver,
    duration,
    compiling,
    error,
    missingBundle,
  } = usePlaygroundExample(example, { preview: true, enabled: visible });

  const handleMouseEnter = () => {
    if (isMobile) return;
    setIsHovering(true);
    hoverTimeoutRef.current = window.setTimeout(() => {
      playerRef.current?.play();
    }, 400);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setIsHovering(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    playerRef.current?.pause();
  };

  const handleClick = () => {
    posthog.capture("template_card_clicked", {
      template_id: example.id,
      template_title: example.title,
      category: example.category,
    });
    onSelect?.(example);
  };

  const categoryLabel = example.category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const durationLabel =
    Number.isInteger(duration) ? `${duration}s` : `${duration.toFixed(1)}s`;

  return (
    <button
      ref={rootRef}
      type="button"
      className="group block w-full text-left"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        className={`
          overflow-hidden rounded-xl bg-neutral-900 transition-all duration-200
          ${isHovering ? "scale-[1.03] shadow-xl shadow-black/30" : "shadow-lg shadow-black/20"}
        `}
      >
        <div className="relative aspect-video bg-neutral-950">
          {(missingBundle || error) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/90 p-3 text-center text-xs text-amber-200">
              {error?.message ??
                "Missing bundle — run `just generate-examples`"}
            </div>
          )}
          <Player
            ref={playerRef}
            template={template ?? undefined}
            assets={assets}
            assetResolver={assetResolver}
            format="horizontal"
            playbackMode="loop"
            loadMode="eager"
            autoPlay
            hoverBehavior="none"
            className="h-full w-full"
            style={{ aspectRatio: "16/9" }}
          />
          {compiling && !template && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/60 text-xs text-white/70">
              Loading…
            </div>
          )}

          <div
            className={`
              pointer-events-none absolute inset-0 flex items-center justify-center
              transition-opacity duration-200
              ${isHovering ? "opacity-0" : "opacity-100"}
            `}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="white"
                className="ml-0.5"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {durationLabel}
          </div>

          {example.playground?.needsBundle && (
            <div className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
              Bundle
            </div>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-medium text-white group-hover:text-primary">
            {example.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {categoryLabel}
          </p>
        </div>
      </div>
    </button>
  );
}