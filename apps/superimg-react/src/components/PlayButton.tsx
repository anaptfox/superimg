//! PlayButton - Reusable play/pause button component

import { useSyncExternalStore } from "react";
import type { PlayerStore } from "superimg/browser";

export interface PlayButtonProps {
  /** The player store to control */
  store: PlayerStore;
  /** Optional CSS class name */
  className?: string;
  /** Button size preset */
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: 24, md: 32, lg: 40 };
const iconSizes = { sm: 12, md: 16, lg: 20 };

function PlayIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ marginLeft: size * 0.1 }}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

/**
 * A play/pause button that syncs with a PlayerStore.
 *
 * @example
 * ```tsx
 * const { store } = useVideoSession(config);
 *
 * <PlayButton store={store} size="md" />
 * ```
 */
export function PlayButton({ store, className, size = "md" }: PlayButtonProps) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  return (
    <button
      onClick={() => store.getState().togglePlayPause()}
      className={className}
      style={{
        width: sizes[size],
        height: sizes[size],
        borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.1)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
      }}
    >
      {state.isPlaying ? (
        <PauseIcon size={iconSizes[size]} />
      ) : (
        <PlayIcon size={iconSizes[size]} />
      )}
    </button>
  );
}
