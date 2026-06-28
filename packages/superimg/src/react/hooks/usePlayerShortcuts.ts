//! Keyboard shortcuts for player-driven UIs (playground editor)

import { useEffect, type RefObject } from "react";
import type { PlayerRef } from "../components/Player.js";

export interface UsePlayerShortcutsOptions {
  /** Skip shortcuts when focus is in inputs or code editor */
  enabled?: boolean;
  /** Toggle loop playback mode */
  onToggleLoop?: () => void;
  /** Navigate away (e.g. Escape → examples grid) */
  onEscape?: () => void;
}

export function usePlayerShortcuts(
  playerRef: RefObject<PlayerRef | null>,
  options: UsePlayerShortcutsOptions = {},
): void {
  const { enabled = true, onToggleLoop, onEscape } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.target as HTMLElement)?.closest(".cm-editor")) {
        return;
      }

      const store = playerRef.current?.store;
      if (!store) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          store.togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (!store.getState().isPlaying) {
            const frame = store.getState().currentFrame;
            store.seekFrame(Math.max(0, frame - (e.shiftKey ? 10 : 1)));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!store.getState().isPlaying) {
            const { currentFrame, totalFrames } = store.getState();
            store.seekFrame(Math.min(totalFrames - 1, currentFrame + (e.shiftKey ? 10 : 1)));
          }
          break;
        case "Home":
          e.preventDefault();
          store.seekFrame(0);
          break;
        case "End": {
          e.preventDefault();
          const { totalFrames } = store.getState();
          store.seekFrame(totalFrames - 1);
          break;
        }
        case "KeyL":
          if (onToggleLoop) {
            e.preventDefault();
            onToggleLoop();
          }
          break;
        case "Escape":
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, playerRef, onToggleLoop, onEscape]);
}