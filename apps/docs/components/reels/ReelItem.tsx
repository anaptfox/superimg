//! ReelItem - Individual reel wrapper with snap styles and overlay support

"use client";

import { useRef, useEffect, forwardRef, useImperativeHandle, memo, useCallback } from "react";
import { Player, type PlayerRef } from "superimg-react/player";
import type { PlayerInput, FormatOption } from "superimg/browser";
import { useVisibility } from "./useVisibility";

export interface ReelItemData {
  id: string | number;
  /** Template module (use this OR code, not both) */
  template?: PlayerInput;
  /** Raw code string (use this OR template, not both) */
  code?: string;
  [key: string]: unknown;
}

export interface ReelItemProps {
  item: ReelItemData;
  index: number;
  isActive: boolean;
  isNearby: boolean;
  isHorizontal?: boolean;
  format?: FormatOption;
  renderOverlay?: (
    item: ReelItemData,
    index: number,
    isActive: boolean
  ) => React.ReactNode;
  onVisibilityChange?: (index: number, isVisible: boolean) => void;
  onProgress?: (index: number, progress: number) => void;
  onTap?: () => void;
}

export interface ReelItemRef {
  play: () => void;
  pause: () => void;
  reset: () => void;
  playerRef: PlayerRef | null;
}

export const ReelItem = memo(forwardRef<ReelItemRef, ReelItemProps>(
  function ReelItem(
    {
      item,
      index,
      isActive,
      isNearby,
      isHorizontal = false,
      format = "vertical",
      renderOverlay,
      onVisibilityChange,
      onProgress,
      onTap,
    },
    ref
  ) {
    const playerRef = useRef<PlayerRef>(null);
    const { ref: visibilityRef, isVisible } = useVisibility({ threshold: 0.5 });

    // Report visibility changes
    useEffect(() => {
      onVisibilityChange?.(index, isVisible);
    }, [index, isVisible, onVisibilityChange]);

    // Play/pause based on active state
    useEffect(() => {
      // Small delay to ensure player is fully initialized
      const timer = setTimeout(() => {
        const player = playerRef.current;
        if (!player?.isReady) return;

        try {
          if (isActive) {
            player.play();
          } else {
            player.pause();
            player.seekToFrame(0);
          }
        } catch {
          // Player not ready yet, ignore
        }
      }, 100);

      return () => clearTimeout(timer);
    }, [isActive]);

    // Track playback progress for story indicators (throttled to every 5 frames to reduce re-renders)
    const frameCountRef = useRef(0);
    const handleFrame = useCallback((frame: number) => {
      frameCountRef.current++;
      if (frameCountRef.current % 5 !== 0) return; // Only update every 5 frames

      const player = playerRef.current;
      if (player && player.totalFrames > 0) {
        const progress = frame / player.totalFrames;
        onProgress?.(index, progress);
      }
    }, [index, onProgress]);

    // Expose ref API
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          if (playerRef.current?.isReady) {
            playerRef.current.play();
          }
        },
        pause: () => {
          if (playerRef.current?.isReady) {
            playerRef.current.pause();
          }
        },
        reset: () => {
          if (playerRef.current?.isReady) {
            playerRef.current.pause();
            playerRef.current.seekToFrame(0);
          }
        },
        playerRef: playerRef.current,
      }),
      []
    );

    // Handle tap/click to toggle play
    const handleClick = () => {
      onTap?.();
    };

    return (
      <div
        ref={visibilityRef}
        data-index={index}
        onClick={handleClick}
        style={{
          height: "100dvh",
          width: isHorizontal ? "100vw" : "100%",
          flexShrink: 0,
          scrollSnapAlign: "start",
          scrollSnapStop: "always",
          position: "relative",
          background: "#000",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Always render Player to prevent flicker - hide with CSS when not nearby */}
        <Player
          ref={playerRef}
          template={item.template}
          code={item.code}
          format={format}
          playbackMode="loop"
          loadMode="lazy"
          autoPlay={isActive}
          onFrame={handleFrame}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: isHorizontal ? "auto" : "100%",
            maxHeight: "100%",
            // Hide non-nearby players with CSS instead of unmounting
            // This prevents the flash when scrolling between reels
            visibility: isNearby ? "visible" : "hidden",
            opacity: isNearby ? 1 : 0,
          }}
        />

        {/* Overlay */}
        {renderOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            <div style={{ pointerEvents: "auto", height: "100%" }}>
              {renderOverlay(item, index, isActive)}
            </div>
          </div>
        )}
      </div>
    );
  }
));
