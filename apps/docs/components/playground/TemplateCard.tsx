"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Player, type PlayerRef } from "superimg-react";
import type { EditorExample } from "@/lib/video/examples";
import { useIsMobile } from "@/hooks/use-mobile";

interface TemplateCardProps {
  example: EditorExample;
}

export function TemplateCard({ example }: TemplateCardProps) {
  const playerRef = useRef<PlayerRef>(null);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const [isHovering, setIsHovering] = useState(false);
  const isMobile = useIsMobile();

  const handleMouseEnter = () => {
    if (isMobile) return;
    setIsHovering(true);
    // Delay before starting playback
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
    playerRef.current?.stop();
  };

  // Format category for display
  const categoryLabel = example.category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <Link
      href={`/playground/${example.id}`}
      className="group block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`
          overflow-hidden rounded-xl bg-neutral-900 transition-all duration-200
          ${isHovering ? "scale-[1.03] shadow-xl shadow-black/30" : "shadow-lg shadow-black/20"}
        `}
      >
        {/* Video Preview Area */}
        <div className="relative aspect-video bg-neutral-950">
          <Player
            ref={playerRef}
            code={example.code}
            format="horizontal"
            playbackMode="loop"
            loadMode="lazy"
            hoverBehavior="none"
            className="h-full w-full"
            style={{ aspectRatio: "16/9" }}
          />

          {/* Play icon overlay */}
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

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            5s
          </div>
        </div>

        {/* Card Info */}
        <div className="p-3">
          <h3 className="font-medium text-white group-hover:text-primary">
            {example.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {categoryLabel}
          </p>
        </div>
      </div>
    </Link>
  );
}
