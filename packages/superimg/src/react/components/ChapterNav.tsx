//! Chapter/checkpoint navigation component

import { type RefObject } from "react";
import { useCheckpoints } from "../hooks/useCheckpoints.js";
import type { PlayerRef } from "./Player.js";

export interface ChapterNavProps {
  /** Player ref to control */
  playerRef: RefObject<PlayerRef | null>;
  /** Layout variant */
  variant?: "dropdown" | "buttons" | "pills";
  /** CSS class for the container */
  className?: string;
  /** Show prev/next buttons (default: true) */
  showPrevNext?: boolean;
  /** Label for dropdown placeholder */
  dropdownLabel?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

/**
 * Formats seconds as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Chapter navigation component for checkpoint-based video navigation.
 *
 * @example
 * ```tsx
 * // Dropdown variant (default)
 * <ChapterNav playerRef={playerRef} variant="dropdown" showPrevNext />
 *
 * // Buttons variant
 * <ChapterNav playerRef={playerRef} variant="buttons" />
 *
 * // Pills variant
 * <ChapterNav playerRef={playerRef} variant="pills" />
 * ```
 */
export function ChapterNav({
  playerRef,
  variant = "dropdown",
  className,
  showPrevNext = true,
  dropdownLabel = "Jump to...",
  style,
}: ChapterNavProps) {
  const { checkpoints, current, goTo, next, prev, hasNext, hasPrev } = useCheckpoints(playerRef);

  if (checkpoints.length === 0) {
    return null;
  }

  if (variant === "dropdown") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          ...style,
        }}
      >
        {showPrevNext && (
          <button
            onClick={prev}
            disabled={!hasPrev}
            style={{
              padding: "4px 8px",
              cursor: hasPrev ? "pointer" : "not-allowed",
              opacity: hasPrev ? 1 : 0.5,
            }}
            title="Previous chapter"
          >
            ←
          </button>
        )}

        <select
          value={current?.id ?? ""}
          onChange={(e) => goTo(e.target.value)}
          style={{
            padding: "4px 8px",
            minWidth: "150px",
          }}
        >
          {!current && <option value="">{dropdownLabel}</option>}
          {checkpoints.map((cp) => (
            <option key={cp.id} value={cp.id}>
              {cp.label || cp.id} ({formatTime(cp.time)})
            </option>
          ))}
        </select>

        {showPrevNext && (
          <button
            onClick={next}
            disabled={!hasNext}
            style={{
              padding: "4px 8px",
              cursor: hasNext ? "pointer" : "not-allowed",
              opacity: hasNext ? 1 : 0.5,
            }}
            title="Next chapter"
          >
            →
          </button>
        )}
      </div>
    );
  }

  if (variant === "buttons") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexWrap: "wrap",
          ...style,
        }}
      >
        {checkpoints.map((cp) => {
          const isActive = current?.id === cp.id;
          return (
            <button
              key={cp.id}
              onClick={() => goTo(cp.id)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                backgroundColor: isActive ? "#3b82f6" : "transparent",
                color: isActive ? "#fff" : "inherit",
                border: "1px solid",
                borderColor: isActive ? "#3b82f6" : "#ccc",
                borderRadius: "4px",
                fontWeight: isActive ? "bold" : "normal",
              }}
              title={formatTime(cp.time)}
            >
              {cp.label || cp.id}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "pills") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          ...style,
        }}
      >
        {checkpoints.map((cp, index) => {
          const isActive = current?.id === cp.id;
          const isFirst = index === 0;
          const isLast = index === checkpoints.length - 1;
          return (
            <button
              key={cp.id}
              onClick={() => goTo(cp.id)}
              style={{
                padding: "4px 10px",
                cursor: "pointer",
                backgroundColor: isActive ? "#3b82f6" : "#e5e7eb",
                color: isActive ? "#fff" : "#374151",
                border: "none",
                borderRadius: isFirst ? "9999px 0 0 9999px" : isLast ? "0 9999px 9999px 0" : "0",
                fontSize: "12px",
              }}
              title={`${cp.label || cp.id} (${formatTime(cp.time)})`}
            >
              {cp.label || cp.id}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}
