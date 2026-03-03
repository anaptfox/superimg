//! ReelsPlayer - Instagram Reels / TikTok-style video player
//! CSS scroll-snap, auto-play on visibility, keyboard navigation, overlays
//! Desktop: horizontal scroll with left/right keys
//! Mobile: vertical scroll with up/down swipe

"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ReelItem, type ReelItemData, type ReelItemRef } from "./ReelItem";
import { useSwipeGesture } from "./useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FormatOption } from "superimg/browser";

export type { ReelItemData };

export interface ReelsPlayerProps {
  /** Array of reel items to display */
  items: ReelItemData[];
  /** Initial index to display (default: 0) */
  initialIndex?: number;
  /** Called when active reel changes */
  onIndexChange?: (index: number) => void;
  /** Number of reels to preload ahead/behind current (default: 1) */
  preloadCount?: number;
  /** Enable keyboard navigation (default: true) */
  keyboardNavigation?: boolean;
  /** Video format (default: "vertical") */
  format?: FormatOption;
  /** Show story-style progress indicators (default: true) */
  showIndicators?: boolean;
  /** Render overlay content for each reel */
  renderOverlay?: (
    item: ReelItemData,
    index: number,
    isActive: boolean
  ) => React.ReactNode;
  /** Optional CSS class */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

export interface ReelsPlayerRef {
  /** Navigate to specific index */
  goToIndex: (index: number) => void;
  /** Go to next reel */
  next: () => void;
  /** Go to previous reel */
  previous: () => void;
  /** Current active index */
  currentIndex: number;
  /** Play the current reel */
  play: () => void;
  /** Pause the current reel */
  pause: () => void;
  /** Toggle play/pause on current reel */
  togglePlayPause: () => void;
}

// Story-style progress indicators
function StoryIndicators({
  count,
  activeIndex,
  progress,
}: {
  count: number;
  activeIndex: number;
  progress: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: "flex",
        gap: "4px",
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: "linear-gradient(rgba(0,0,0,0.5), transparent)",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "3px",
            borderRadius: "2px",
            background: "rgba(255,255,255,0.3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "white",
              width:
                i < activeIndex
                  ? "100%"
                  : i === activeIndex
                    ? `${progress * 100}%`
                    : "0%",
              transition: i === activeIndex ? "none" : "width 0.2s",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const ReelsPlayer = forwardRef<ReelsPlayerRef, ReelsPlayerProps>(
  function ReelsPlayer(
    {
      items,
      initialIndex = 0,
      onIndexChange,
      preloadCount = 1,
      keyboardNavigation = true,
      format = "vertical",
      showIndicators = true,
      renderOverlay,
      className,
      style,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, ReelItemRef>>(new Map());
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackProgress, setPlaybackProgress] = useState(0);
    const isMobile = useIsMobile();

    // Use refs for values in callbacks to avoid recreation
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // Handle hydration: don't render until isMobile is determined
    const isHydrated = isMobile !== undefined;
    const isHorizontal = !isMobile;

    // Check if an index is within preload window
    const isNearby = useCallback(
      (index: number) => Math.abs(index - activeIndex) <= preloadCount,
      [activeIndex, preloadCount]
    );

    // Navigate to specific index
    const goToIndex = useCallback(
      (index: number) => {
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const element = containerRef.current?.children[
          clampedIndex + (showIndicators ? 1 : 0) // +1 to skip indicators div
        ] as HTMLElement;
        element?.scrollIntoView({
          behavior: "smooth",
          block: isHorizontal ? "nearest" : "start",
          inline: isHorizontal ? "start" : "nearest",
        });
      },
      [items.length, isHorizontal, showIndicators]
    );

    const next = useCallback(() => {
      goToIndex(activeIndex + 1);
    }, [activeIndex, goToIndex]);

    const previous = useCallback(() => {
      goToIndex(activeIndex - 1);
    }, [activeIndex, goToIndex]);

    const play = useCallback(() => {
      setIsPaused(false);
      itemRefs.current.get(activeIndex)?.play();
    }, [activeIndex]);

    const pause = useCallback(() => {
      setIsPaused(true);
      itemRefs.current.get(activeIndex)?.pause();
    }, [activeIndex]);

    const togglePlayPause = useCallback(() => {
      if (isPaused) {
        play();
      } else {
        pause();
      }
    }, [isPaused, play, pause]);

    // Handle visibility changes from ReelItems (uses ref to avoid callback recreation)
    const onIndexChangeRef = useRef(onIndexChange);
    onIndexChangeRef.current = onIndexChange;
    const handleVisibilityChange = useCallback((index: number, isVisible: boolean) => {
      if (isVisible && index !== activeIndexRef.current) {
        setActiveIndex(index);
        setIsPaused(false);
        setPlaybackProgress(0);
        onIndexChangeRef.current?.(index);
      }
    }, []); // Empty deps - never recreates

    // Handle playback progress updates (uses ref to avoid callback recreation)
    const handleProgress = useCallback((index: number, progress: number) => {
      if (index === activeIndexRef.current) {
        setPlaybackProgress(progress);
      }
    }, []); // Empty deps - never recreates

    // Handle tap on reel to toggle play/pause
    const handleTap = useCallback(() => {
      togglePlayPause();
    }, [togglePlayPause]);

    // Keyboard navigation
    useEffect(() => {
      if (!keyboardNavigation) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if user is typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        switch (e.key) {
          // Desktop: left/right, Mobile: up/down
          case "ArrowRight":
          case "ArrowDown":
          case "j":
            e.preventDefault();
            next();
            break;
          case "ArrowLeft":
          case "ArrowUp":
          case "k":
            e.preventDefault();
            previous();
            break;
          case " ":
            e.preventDefault();
            togglePlayPause();
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [keyboardNavigation, next, previous, togglePlayPause]);

    // Touch swipe gestures (supplements native scroll)
    useSwipeGesture(containerRef, {
      onSwipeUp: isMobile ? next : undefined,
      onSwipeDown: isMobile ? previous : undefined,
      threshold: 80,
      velocityThreshold: 0.4,
      enabled: !!isMobile, // Only enable on mobile (false when undefined)
    });

    // Expose ref API
    useImperativeHandle(
      ref,
      () => ({
        goToIndex,
        next,
        previous,
        currentIndex: activeIndex,
        play,
        pause,
        togglePlayPause,
      }),
      [goToIndex, next, previous, activeIndex, play, pause, togglePlayPause]
    );

    // Wait for hydration to complete before rendering scroll container
    // This prevents hydration mismatch between server and client
    if (!isHydrated) {
      return (
        <div
          className={className}
          style={{
            height: "100dvh",
            width: "100%",
            background: "#000",
            ...style,
          }}
        />
      );
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          height: "100dvh",
          width: "100%",
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          overflowX: isHorizontal ? "scroll" : "hidden",
          overflowY: isHorizontal ? "hidden" : "scroll",
          scrollSnapType: isHorizontal ? "x mandatory" : "y mandatory",
          scrollBehavior: "smooth",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          background: "#000",
          position: "relative",
          ...style,
        }}
      >
        {/* Story indicators */}
        {showIndicators && (
          <StoryIndicators
            count={items.length}
            activeIndex={activeIndex}
            progress={playbackProgress}
          />
        )}

        {items.map((item, index) => (
          <ReelItem
            key={item.id}
            ref={(itemRef) => {
              if (itemRef) {
                itemRefs.current.set(index, itemRef);
              } else {
                itemRefs.current.delete(index);
              }
            }}
            item={item}
            index={index}
            isActive={index === activeIndex && !isPaused}
            isNearby={isNearby(index)}
            isHorizontal={isHorizontal}
            format={format}
            renderOverlay={renderOverlay}
            onVisibilityChange={handleVisibilityChange}
            onProgress={handleProgress}
            onTap={handleTap}
          />
        ))}
      </div>
    );
  }
);
