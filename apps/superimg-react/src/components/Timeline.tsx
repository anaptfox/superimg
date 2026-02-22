//! Timeline scrubbing component

import { useRef, forwardRef, useImperativeHandle, useSyncExternalStore, useState } from "react";
import { useTimeline, type UseTimelineReturn } from "../hooks/useTimeline.js";
import type { PlayerStore, Checkpoint } from "superimg";

export interface TimelineProps {
  /** The player store to control */
  store: PlayerStore;
  /** Optional CSS class name for the container */
  className?: string;
  /** Optional inline styles for the container */
  style?: React.CSSProperties;
  /** Custom class for the progress bar */
  progressClassName?: string;
  /** Custom class for the playhead */
  playheadClassName?: string;
  /** Whether to show time labels */
  showTime?: boolean;
  /** Custom class for time labels */
  timeClassName?: string;
  /** Checkpoints to display as markers */
  checkpoints?: Checkpoint[];
  /** Callback when checkpoint marker is clicked */
  onCheckpointClick?: (checkpoint: Checkpoint) => void;
  /** Custom class for checkpoint markers */
  markerClassName?: string;
  /** Show tooltip on marker hover */
  showMarkerTooltip?: boolean;
}

export interface TimelineRef {
  /** The container element */
  container: HTMLDivElement | null;
  /** The timeline hook return value */
  timeline: UseTimelineReturn;
}

/**
 * A timeline scrubbing bar component.
 *
 * @example
 * ```tsx
 * const { store } = usePlayer(config);
 *
 * <Timeline
 *   store={store}
 *   className="timeline"
 *   showTime
 * />
 * ```
 */
export const Timeline = forwardRef<TimelineRef, TimelineProps>(function Timeline(
  {
    store,
    className,
    style,
    progressClassName,
    playheadClassName,
    showTime = false,
    timeClassName,
    checkpoints,
    onCheckpointClick,
    markerClassName,
    showMarkerTooltip = true,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeline = useTimeline(containerRef, store);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  // Subscribe to store state for rendering
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  // Expose container and timeline via ref
  useImperativeHandle(ref, () => ({
    container: containerRef.current,
    timeline,
  }), [timeline]);

  // Calculate progress percentage
  const progress = state.totalFrames > 1
    ? (state.currentFrame / (state.totalFrames - 1)) * 100
    : 0;

  const currentTime = timeline.formatTime(state.currentFrame / state.fps);
  const totalTime = timeline.formatTime(state.totalFrames / state.fps);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        cursor: "pointer",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Track background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "4px",
        }}
      />

      {/* Progress fill */}
      <div
        className={progressClassName}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress}%`,
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          borderRadius: "4px",
          transition: state.isScrubbing ? "none" : "width 0.05s ease-out",
        }}
      />

      {/* Checkpoint markers */}
      {checkpoints?.map((cp) => {
        const markerPosition = state.totalFrames > 1
          ? (cp.frame / (state.totalFrames - 1)) * 100
          : 0;
        const isHovered = hoveredMarker === cp.id;

        return (
          <div
            key={cp.id}
            className={markerClassName}
            style={{
              position: "absolute",
              left: `${markerPosition}%`,
              top: 0,
              width: "4px",
              height: "100%",
              transform: "translateX(-50%)",
              backgroundColor: cp.source.type === "marker" ? "#10b981" : "#6366f1",
              cursor: "pointer",
              zIndex: 1,
              opacity: isHovered ? 1 : 0.8,
            }}
            title={showMarkerTooltip && cp.label ? `${cp.label} (${timeline.formatTime(cp.time)})` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onCheckpointClick?.(cp);
            }}
            onMouseEnter={() => setHoveredMarker(cp.id)}
            onMouseLeave={() => setHoveredMarker(null)}
          />
        );
      })}

      {/* Playhead */}
      <div
        className={playheadClassName}
        style={{
          position: "absolute",
          left: `${progress}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "12px",
          height: "12px",
          backgroundColor: "#3b82f6",
          borderRadius: "50%",
          boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
          transition: state.isScrubbing ? "none" : "left 0.05s ease-out",
          zIndex: 2,
        }}
      />

      {/* Time labels */}
      {showTime && (
        <div
          className={timeClassName}
          style={{
            display: "flex",
            justifyContent: "space-between",
            position: "absolute",
            bottom: "-20px",
            left: 0,
            right: 0,
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          <span>{currentTime}</span>
          <span>{totalTime}</span>
        </div>
      )}
    </div>
  );
});
