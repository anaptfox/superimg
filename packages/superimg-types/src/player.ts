//! Player input guards shared across packages.
//! Canonical PlayerOptions / PlayerEvents live in @superimg/player.

import type { MediaDefinition } from "./define.js";

/** What can be passed to player.load() */
export type PlayerInput = MediaDefinition;

/**
 * Single source of truth for whether a template is animated.
 *
 * Explicit `animated` stamp wins. Otherwise inferred:
 * fps + duration present means animated. IR, engine, CLI metadata, and the
 * runtime must all classify identically — a fork here makes the IR clock and
 * the session clock disagree and every `mediaIR` load fails with
 * IR_CLOCK_MISMATCH (plain module templates without a stamp hit this).
 */
export function inferTemplateAnimated(template: {
  animated?: boolean;
  config?: { fps?: number; duration?: number | string };
}): boolean {
  if (typeof template.animated === "boolean") return template.animated;
  return !!(template.config?.fps && template.config?.duration != null);
}
