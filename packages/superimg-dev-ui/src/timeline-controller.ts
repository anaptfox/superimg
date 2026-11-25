//! Development-only DOM timeline controller.

import type { CheckpointResolver } from "@superimg/core";
import { formatTime, type RuntimeStore } from "@superimg/player";

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
}

export function createTimelineController(
  elements: TimelineElements,
  store: RuntimeStore,
  _checkpointResolver?: CheckpointResolver,
): TimelineController {
  let container: HTMLElement | null = null;
  let scrubbing = false;

  const update = (): void => {
    const state = store.getState();
    const progress = state.totalFrames > 1
      ? state.currentFrame / (state.totalFrames - 1) * 100
      : 0;
    elements.progress.style.width = `${progress}%`;
    elements.playhead.style.left = `${progress}%`;
    if (elements.currentTime) elements.currentTime.textContent = formatTime(state.currentFrame / state.fps);
    if (elements.totalTime) elements.totalTime.textContent = formatTime(state.totalFrames / state.fps);
  };
  const unsubscribe = store.subscribe(update);

  const seek = (event: MouseEvent): void => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const progress = rect.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : 0;
    void store.seekProgress(progress);
  };
  const move = (event: MouseEvent): void => {
    if (scrubbing) seek(event);
  };
  const up = (): void => {
    scrubbing = false;
    store.endScrub();
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
  const down = (event: MouseEvent): void => {
    scrubbing = true;
    store.beginScrub();
    seek(event);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return {
    attach(next) {
      container = next;
      container.addEventListener("mousedown", down);
      update();
    },
    updateMarkers() {},
    destroy() {
      container?.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      unsubscribe();
      container = null;
    },
  };
}
