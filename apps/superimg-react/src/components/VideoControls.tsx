//! VideoControls - Composite component for PlayButton + Timeline

import type { PlayerStore } from "superimg/browser";
import { PlayButton } from "./PlayButton.js";
import { Timeline } from "./Timeline.js";

export interface VideoControlsProps {
  /** The player store to control */
  store: PlayerStore;
  /** Show timeline (default: true) */
  showTimeline?: boolean;
  /** Show time labels on timeline (default: false) */
  showTime?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Composite control bar with play/pause button and optional timeline.
 *
 * @example
 * ```tsx
 * const { store } = useVideoSession(config);
 *
 * <VideoControls store={store} showTime />
 * ```
 */
export function VideoControls({
  store,
  showTimeline = true,
  showTime = false,
  className,
}: VideoControlsProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        background: "rgba(0, 0, 0, 0.6)",
      }}
    >
      <PlayButton store={store} size="md" />
      {showTimeline && (
        <Timeline
          store={store}
          style={{ flex: 1, height: "8px" }}
          showTime={showTime}
        />
      )}
    </div>
  );
}
