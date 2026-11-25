/**
 * director() — unified scene-local timing primitive.
 *
 * Given a phase layout in seconds/percentages, returns an object for declaring
 * motions, tweens, and values scoped to those phases.
 *
 * ```ts
 * const t = ctx.director({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });
 * const card = t.motion();                            // auto enter; last act holds
 * const leave = t.motion({ exit: true });             // opt-in fade out
 * const val  = t.motion({ y: 15, at: "0.1s" });       // stagger 0.1s into enter
 * const cnt  = t.tween(0, target, { during: "enter" });
 * const bar  = t.value(value / target, { fadeOn: "exit" });
 * ```
 *
 * Implementation is split under `./director/` (types, easing, phases, style, clip, factory).
 */

export type {
  PhaseConfig,
  SemanticEasing,
  MotionEasing,
  DirectorOpts,
  MotionOpts,
  MotionResult,
  MotionValue,
  TweenOpts,
  ValueOpts,
  ValueResult,
  InOpts,
  BeatsOpts,
  BeatState,
  Director,
  DirectorOf,
  DirectorInstrument,
  DirectorContext,
  ClipOpts,
  DirectorClip,
  NormalizedPhase,
} from "./director/types.js";

export { layoutPhases } from "./director/phases.js";
export { mergeMotion } from "./director/style.js";
export { createDirector } from "./director/create-director.js";
