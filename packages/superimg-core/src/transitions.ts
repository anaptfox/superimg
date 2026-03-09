//! Transition rendering - wrap scene HTML with CSS transitions

import type {
  Duration,
  ResolvedTransition,
  Transition,
} from "@superimg/types";
import {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
} from "@superimg/stdlib";

/** Lookup map for easing functions by name */
const EASING_MAP: Record<string, (t: number) => number> = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
};

/**
 * Apply an easing function to a linear progress value.
 * Falls back to linear if easing name is not recognized.
 */
function applyEasing(t: number, easingName?: string): number {
  if (!easingName) return t;
  const fn = EASING_MAP[easingName];
  return fn ? fn(t) : t;
}

/** Transition presets for common enter/exit effects */
export const transitions = {
  fade: (duration: Duration, easing?: string): Transition => ({
    type: "fade",
    duration,
    easing,
  }),
  slideLeft: (duration: Duration, easing?: string): Transition => ({
    type: "slide-left",
    duration,
    easing,
  }),
  slideRight: (duration: Duration, easing?: string): Transition => ({
    type: "slide-right",
    duration,
    easing,
  }),
  slideUp: (duration: Duration, easing?: string): Transition => ({
    type: "slide-up",
    duration,
    easing,
  }),
  slideDown: (duration: Duration, easing?: string): Transition => ({
    type: "slide-down",
    duration,
    easing,
  }),
  none: (): Transition => ({ type: "none", duration: 0 }),
};

type TransitionPhase = "enter" | "exit";

/**
 * Wrap scene HTML with transition effects during enter/exit.
 * Uses CSS opacity and transform for fade/slide transitions.
 *
 * @param html - Raw scene HTML
 * @param transition - Resolved transition (enter or exit)
 * @param progress - 0 = start of transition, 1 = end
 * @param phase - "enter" = fade in (progress 0 invisible → 1 visible), "exit" = fade out (progress 0 visible → 1 invisible)
 * @returns HTML wrapped with transition styling
 */
export function renderWithTransition(
  html: string,
  transition: ResolvedTransition,
  progress: number,
  phase: TransitionPhase = "enter"
): string {
  if (transition.type === "none") {
    return html;
  }

  const clampedProgress = Math.max(0, Math.min(progress, 1));
  // For exit: progress 0 = visible, 1 = invisible
  // For enter: progress 0 = invisible, 1 = visible
  const linearT = phase === "exit" ? 1 - clampedProgress : clampedProgress;
  const t = applyEasing(linearT, transition.easing);

  let opacity = 1;
  let transform = "none";

  switch (transition.type) {
    case "fade":
      opacity = t;
      break;
    case "slide-left":
      // Slides: just transform, no fade
      transform =
        phase === "enter"
          ? `translateX(${(1 - t) * 100}%)`
          : `translateX(${-t * 100}%)`;
      break;
    case "slide-right":
      transform =
        phase === "enter"
          ? `translateX(${(1 - t) * -100}%)`
          : `translateX(${t * 100}%)`;
      break;
    case "slide-up":
      transform =
        phase === "enter"
          ? `translateY(${(1 - t) * 100}%)`
          : `translateY(${-t * 100}%)`;
      break;
    case "slide-down":
      transform =
        phase === "enter"
          ? `translateY(${(1 - t) * -100}%)`
          : `translateY(${t * 100}%)`;
      break;
    default:
      return html;
  }

  const styles = [
    `position:absolute`,
    `inset:0`,
    `width:100%`,
    `height:100%`,
  ];

  if (opacity !== 1) {
    styles.push(`opacity:${opacity}`);
  }
  if (transform !== "none") {
    styles.push(`transform:${transform}`);
  }

  return `<div style="${styles.join(";")}">${html}</div>`;
}
