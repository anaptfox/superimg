//! Pure hot-reload classification for browser and embedded Studio hosts.
//! Extends hash-only classifyChange with clock comparison and error → stale.

import type { MediaIRHashes, MediaIR } from "@superimg/types";
import { classifyChange, type ChangeClass } from "./dev-server-ir.js";

/** Local clamp so this module stays pure without requiring a rebuilt core dist. */
function clampPlayheadFrame(frame: number, totalFrames: number): number {
  const max = Math.max(0, Math.floor(totalFrames) - 1);
  if (!Number.isFinite(frame)) return 0;
  return Math.max(0, Math.min(max, Math.floor(frame)));
}

export type HotReloadClass =
  | "no-change"
  | "markup-update"
  | "intent-compatible"
  | "clock-change"
  | "compile-error"
  | "reload";

export interface HotReloadDecision {
  class: HotReloadClass;
  /** Preserve last valid IR/preview when true (compile-error). */
  keepStalePreview: boolean;
  /** Clamp playhead into next clock. */
  clampPlayhead: boolean;
  /** Prefer preserving selection by stable id. */
  preserveSelectionById: boolean;
  nextPlayheadFrame?: number;
}

export interface StudioSelection {
  frame: number;
  laneId?: string;
  itemId?: string;
  range?: { startFrame: number; endFrame: number };
  sceneId?: string;
  nodeId?: string;
  motionId?: string;
}

function clocksCompatible(prev: MediaIR, next: MediaIR): boolean {
  return (
    prev.clock.fps === next.clock.fps &&
    prev.clock.totalFrames === next.clock.totalFrames &&
    prev.clock.durationSeconds === next.clock.durationSeconds &&
    prev.canvas.width === next.canvas.width &&
    prev.canvas.height === next.canvas.height
  );
}

/**
 * Classify an IR update for Studio hot reload.
 * When `compileError` is true, always keep last valid preview marked stale.
 */
export function classifyHotReload(input: {
  prev: MediaIR | null;
  next: MediaIR | null;
  compileError?: boolean;
  playheadFrame?: number;
}): HotReloadDecision {
  if (input.compileError || !input.next) {
    return {
      class: "compile-error",
      keepStalePreview: true,
      clampPlayhead: false,
      preserveSelectionById: true,
    };
  }

  if (!input.prev) {
    return {
      class: "reload",
      keepStalePreview: false,
      clampPlayhead: true,
      preserveSelectionById: false,
      nextPlayheadFrame: clampPlayheadFrame(
        input.playheadFrame ?? 0,
        input.next.clock.totalFrames,
      ),
    };
  }

  const hashClass: ChangeClass = classifyChange(
    input.prev.hashes,
    input.next.hashes,
  );

  if (hashClass === "no-change") {
    return {
      class: "no-change",
      keepStalePreview: false,
      clampPlayhead: false,
      preserveSelectionById: true,
    };
  }

  if (hashClass === "markup-update") {
    return {
      class: "markup-update",
      keepStalePreview: false,
      clampPlayhead: false,
      preserveSelectionById: true,
      nextPlayheadFrame: clampPlayheadFrame(
        input.playheadFrame ?? 0,
        input.next.clock.totalFrames,
      ),
    };
  }

  // intent changed
  if (clocksCompatible(input.prev, input.next)) {
    return {
      class: "intent-compatible",
      keepStalePreview: false,
      clampPlayhead: false,
      preserveSelectionById: true,
      nextPlayheadFrame: clampPlayheadFrame(
        input.playheadFrame ?? 0,
        input.next.clock.totalFrames,
      ),
    };
  }

  return {
    class: "clock-change",
    keepStalePreview: false,
    clampPlayhead: true,
    preserveSelectionById: true,
    nextPlayheadFrame: clampPlayheadFrame(
      input.playheadFrame ?? 0,
      input.next.clock.totalFrames,
    ),
  };
}

/**
 * Remap selection after IR replacement when possible (stable item id).
 * Falls back to clamped frame-only selection.
 */
export function remapSelection(input: {
  selection: StudioSelection;
  next: MediaIR;
  /** Known item ids present in next timeline (caller supplies from projection). */
  nextItemIds: ReadonlySet<string>;
}): StudioSelection {
  const frame = clampPlayheadFrame(
    input.selection.frame,
    input.next.clock.totalFrames,
  );
  const itemId = input.selection.itemId;
  if (itemId && input.nextItemIds.has(itemId)) {
    return { ...input.selection, frame };
  }
  // Drop item-specific ids that no longer exist; keep frame.
  return {
    frame,
  };
}

export type { ChangeClass, MediaIRHashes };
