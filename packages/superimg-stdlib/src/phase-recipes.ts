/**
 * Named phase layouts — establish → develop → resolve craft recipes.
 */

import {
  layoutTimeline,
  type LayoutTimelineResult,
} from "./layout-timeline.js";
import { readTimeSeconds } from "./timing.js";

export type PhaseRecipeName =
  | "card"
  | "establish"
  | "punchy"
  | "hold-heavy"
  | "hook";

/** Percent phase configs (sum 100%). */
export const PHASE_RECIPES: Record<PhaseRecipeName, Record<string, string>> = {
  /** Current director default — balanced card. */
  card: { enter: "15%", hold: "70%", exit: "15%" },
  /** General video: slightly longer establish, exit band for resolve. */
  establish: { enter: "20%", hold: "62%", exit: "18%" },
  /** Social / short-form beats. */
  punchy: { enter: "25%", hold: "50%", exit: "25%" },
  /** Data / reading — long settle. */
  "hold-heavy": { enter: "12%", hold: "76%", exit: "12%" },
  /** Short-form openers. */
  hook: { enter: "30%", hold: "50%", exit: "20%" },
};

export function recipe(name: PhaseRecipeName): Record<string, string> {
  const r = PHASE_RECIPES[name];
  if (!r) {
    throw new Error(
      `Unknown phase recipe "${name}". Known: ${Object.keys(PHASE_RECIPES).join(", ")}`,
    );
  }
  return { ...r };
}

/**
 * Text-driven scene: enter + readTime hold + faster exit → layoutTimeline.
 */
export function fromText(
  text: string,
  opts?: {
    enter?: number;
    exitSpeed?: number;
    pad?: number;
    holdMin?: number;
  },
): LayoutTimelineResult {
  const enter = opts?.enter ?? 0.5;
  const exitSpeed = opts?.exitSpeed ?? 1.25;
  const hold =
    Math.max(opts?.holdMin ?? 0, readTimeSeconds(text)) + (opts?.pad ?? 0.5);
  const exit = enter / exitSpeed;
  return layoutTimeline({ enter, hold, exit });
}

/** Namespace for `std.phases`. */
export const phases = {
  recipe,
  fromText,
  RECIPES: PHASE_RECIPES,
} as const;
