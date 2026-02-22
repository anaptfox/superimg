//! Checkpoint navigation controls

import type { Checkpoint } from "@superimg/types";
import type { CheckpointResolver } from "@superimg/core";
import type { PlayerStore } from "./state.js";
import { formatTime } from "./timeline.js";

export interface CheckpointControlsOptions {
  /** Container element to render controls into */
  container: HTMLElement;
  /** Player store for state management */
  store: PlayerStore;
  /** Checkpoint resolver for navigation */
  checkpointResolver: CheckpointResolver;
  /** Layout variant (default: "dropdown") */
  variant?: "dropdown" | "buttons";
  /** Show prev/next buttons (default: true) */
  showPrevNext?: boolean;
  /** Callback when checkpoint changes */
  onCheckpointChange?: (checkpoint: Checkpoint) => void;
  /** CSS class for the container */
  className?: string;
}

export interface CheckpointControls {
  /** The control element */
  element: HTMLElement;
  /** Update controls to reflect current state */
  update(): void;
  /** Clean up and remove controls */
  destroy(): void;
}

/**
 * Creates checkpoint navigation controls (dropdown or buttons)
 */
export function createCheckpointControls(
  options: CheckpointControlsOptions
): CheckpointControls {
  const {
    container,
    store,
    checkpointResolver,
    variant = "dropdown",
    showPrevNext = true,
    onCheckpointChange,
    className,
  } = options;

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  if (className) {
    wrapper.className = className;
  }

  let unsubscribe: (() => void) | null = null;

  const goToCheckpoint = (id: string) => {
    const checkpoint = checkpointResolver.get(id);
    if (checkpoint) {
      store.getState().setFrame(checkpoint.frame);
      onCheckpointChange?.(checkpoint);
    }
  };

  const goToPrev = () => {
    const { currentFrame } = store.getState();
    const prev = checkpointResolver.getPrevious(currentFrame);
    if (prev) {
      store.getState().setFrame(prev.frame);
      onCheckpointChange?.(prev);
    }
  };

  const goToNext = () => {
    const { currentFrame } = store.getState();
    const next = checkpointResolver.getNext(currentFrame);
    if (next) {
      store.getState().setFrame(next.frame);
      onCheckpointChange?.(next);
    }
  };

  if (variant === "dropdown") {
    // Previous button
    let prevButton: HTMLButtonElement | null = null;
    let nextButton: HTMLButtonElement | null = null;
    let select: HTMLSelectElement | null = null;

    if (showPrevNext) {
      prevButton = document.createElement("button");
      prevButton.textContent = "←";
      prevButton.title = "Previous checkpoint";
      prevButton.style.padding = "4px 8px";
      prevButton.style.cursor = "pointer";
      prevButton.addEventListener("click", goToPrev);
      wrapper.appendChild(prevButton);
    }

    // Dropdown
    select = document.createElement("select");
    select.style.padding = "4px 8px";
    select.style.minWidth = "150px";

    const checkpoints = checkpointResolver.getAll();
    for (const cp of checkpoints) {
      const option = document.createElement("option");
      option.value = cp.id;
      option.textContent = `${cp.label || cp.id} (${formatTime(cp.time)})`;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      goToCheckpoint(select!.value);
    });
    wrapper.appendChild(select);

    if (showPrevNext) {
      nextButton = document.createElement("button");
      nextButton.textContent = "→";
      nextButton.title = "Next checkpoint";
      nextButton.style.padding = "4px 8px";
      nextButton.style.cursor = "pointer";
      nextButton.addEventListener("click", goToNext);
      wrapper.appendChild(nextButton);
    }

    // Subscribe to state changes to update selection
    unsubscribe = store.subscribe((state) => {
      const current = checkpointResolver.getAt(state.currentFrame);
      if (select && current) {
        select.value = current.id;
      }
      // Update button disabled states
      if (prevButton) {
        const hasPrev = checkpointResolver.getPrevious(state.currentFrame) !== undefined;
        prevButton.disabled = !hasPrev;
      }
      if (nextButton) {
        const hasNext = checkpointResolver.getNext(state.currentFrame) !== undefined;
        nextButton.disabled = !hasNext;
      }
    });
  } else {
    // Buttons variant
    const checkpoints = checkpointResolver.getAll();
    const buttons: HTMLButtonElement[] = [];

    for (const cp of checkpoints) {
      const button = document.createElement("button");
      button.textContent = cp.label || cp.id;
      button.title = formatTime(cp.time);
      button.dataset.checkpointId = cp.id;
      button.style.padding = "4px 12px";
      button.style.cursor = "pointer";
      button.addEventListener("click", () => goToCheckpoint(cp.id));
      buttons.push(button);
      wrapper.appendChild(button);
    }

    // Subscribe to state changes to highlight current
    unsubscribe = store.subscribe((state) => {
      const current = checkpointResolver.getAt(state.currentFrame);
      for (const button of buttons) {
        const isActive = current && button.dataset.checkpointId === current.id;
        button.style.fontWeight = isActive ? "bold" : "normal";
        button.style.backgroundColor = isActive ? "#3b82f6" : "";
        button.style.color = isActive ? "#fff" : "";
      }
    });
  }

  container.appendChild(wrapper);

  return {
    element: wrapper,

    update() {
      // Force state update
      const state = store.getState();
      const current = checkpointResolver.getAt(state.currentFrame);
      if (variant === "dropdown") {
        const select = wrapper.querySelector("select");
        if (select && current) {
          select.value = current.id;
        }
      }
    },

    destroy() {
      if (unsubscribe) {
        unsubscribe();
      }
      wrapper.remove();
    },
  };
}
