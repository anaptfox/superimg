//! Timeline scrubbing controller

import type { Checkpoint } from "@superimg/types";
import type { CheckpointResolver } from "@superimg/core";
import type { PlayerStore } from "./state.js";

export interface TimelineController {
  attach(container: HTMLElement): void;
  updateMarkers(): void;
  destroy(): void;
}

export interface TimelineElements {
  progress: HTMLElement;
  playhead: HTMLElement;
  currentTime?: HTMLElement;
  totalTime?: HTMLElement;
  /** Container for checkpoint markers */
  checkpointMarkers?: HTMLElement;
}

export interface CheckpointMarkerOptions {
  /** CSS class for markers */
  markerClassName?: string;
  /** Whether markers are clickable (default: true) */
  clickable?: boolean;
  /** Show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Callback when marker is clicked */
  onMarkerClick?: (checkpoint: Checkpoint) => void;
}

/**
 * Formats seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Renders checkpoint markers in a container element
 */
export function renderCheckpointMarkers(
  container: HTMLElement,
  checkpoints: Checkpoint[],
  totalFrames: number,
  options: CheckpointMarkerOptions = {}
): void {
  const { markerClassName, clickable = true, showTooltip = true, onMarkerClick } = options;

  // Clear existing markers
  container.innerHTML = "";

  for (const checkpoint of checkpoints) {
    const marker = document.createElement("div");

    // Position marker
    const position = totalFrames > 1 ? (checkpoint.frame / (totalFrames - 1)) * 100 : 0;
    marker.style.position = "absolute";
    marker.style.left = `${position}%`;
    marker.style.top = "0";
    marker.style.width = "4px";
    marker.style.height = "100%";
    marker.style.transform = "translateX(-50%)";
    marker.style.pointerEvents = clickable ? "auto" : "none";

    // Style based on checkpoint source type
    if (checkpoint.source.type === "marker") {
      marker.style.backgroundColor = "#10b981"; // emerald for markers
    } else {
      marker.style.backgroundColor = "#6366f1"; // indigo for runtime
    }

    // Custom class
    if (markerClassName) {
      marker.className = markerClassName;
    }

    // Tooltip
    if (showTooltip && checkpoint.label) {
      marker.title = `${checkpoint.label} (${formatTime(checkpoint.time)})`;
    }

    // Data attributes
    marker.dataset.checkpointId = checkpoint.id;
    marker.dataset.checkpointType = checkpoint.source.type;

    // Click handler
    if (clickable) {
      marker.style.cursor = "pointer";
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        onMarkerClick?.(checkpoint);
      });
    }

    container.appendChild(marker);
  }
}

/**
 * Creates a timeline controller for scrubbing and time display.
 * Subscribes to the store for reactive updates.
 */
export function createTimelineController(
  elements: TimelineElements,
  store: PlayerStore,
  checkpointResolver?: CheckpointResolver,
  markerOptions?: CheckpointMarkerOptions
): TimelineController {
  let container: HTMLElement | null = null;
  let isScrubbing = false;
  let unsubscribe: (() => void) | null = null;

  // Render initial checkpoint markers
  const updateMarkers = () => {
    if (elements.checkpointMarkers && checkpointResolver) {
      const { totalFrames } = store.getState();
      renderCheckpointMarkers(
        elements.checkpointMarkers,
        checkpointResolver.getAll(),
        totalFrames,
        markerOptions
      );
    }
  };

  // Subscribe to store for reactive updates
  unsubscribe = store.subscribe((state) => {
    const { currentFrame, totalFrames, fps } = state;
    const progress = totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

    elements.progress.style.width = `${progress}%`;
    elements.playhead.style.left = `${progress}%`;

    if (elements.currentTime) {
      elements.currentTime.textContent = formatTime(currentFrame / fps);
    }
    if (elements.totalTime) {
      elements.totalTime.textContent = formatTime(totalFrames / fps);
    }
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!isScrubbing || !container) return;
    const rect = container.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const { totalFrames } = store.getState();
    const targetFrame = Math.floor(position * (totalFrames - 1));
    store.getState().scrubTo(targetFrame);
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    isScrubbing = false;
    store.getState().stopScrubbing();
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const { totalFrames } = store.getState();
    const targetFrame = Math.floor(position * (totalFrames - 1));

    isScrubbing = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    store.getState().startScrubbing(targetFrame);
  };

  return {
    attach(containerEl: HTMLElement) {
      container = containerEl;
      container.addEventListener("mousedown", handleMouseDown);

      // Trigger initial update
      const state = store.getState();
      const { currentFrame, totalFrames, fps } = state;
      const progress = totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * 100 : 0;
      elements.progress.style.width = `${progress}%`;
      elements.playhead.style.left = `${progress}%`;
      if (elements.currentTime) {
        elements.currentTime.textContent = formatTime(currentFrame / fps);
      }
      if (elements.totalTime) {
        elements.totalTime.textContent = formatTime(totalFrames / fps);
      }

      // Render checkpoint markers
      updateMarkers();
    },

    updateMarkers,

    destroy() {
      if (container) {
        container.removeEventListener("mousedown", handleMouseDown);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (unsubscribe) {
        unsubscribe();
      }
    },
  };
}
