//! Public types for director() — phase layout, motion, clips, instrumentation.

import type { Timeline } from "@superimg/types";
import type { EasingFn, EasingName } from "../easing.js";
import type { SpringConfig, SpringName } from "../spring.js";
import type { MotionTone } from "../motion-presets.js";

/** Explicit [startSec, endSec] window in seconds. */
export type PhaseTimeWindow = readonly [startSec: number, endSec: number];

/**
 * Single phase value:
 * - percentage string ("20%")
 * - duration string ("0.6s", "600ms")
 * - positive number of seconds (1.5)
 * - explicit [startSec, endSec] window tuple ([0.8, 12.6])
 */
export type PhaseValue = string | number | PhaseTimeWindow;

/** Flat map of phase/act/cue names to phase values. */
export type FlatPhaseConfig = Record<string, PhaseValue>;

/** Structured config separating overlapping acts and micro-cues. */
export interface StructuredPhaseConfig<
  Acts extends FlatPhaseConfig = FlatPhaseConfig,
  Cues extends FlatPhaseConfig = FlatPhaseConfig,
> {
  readonly acts?: Acts;
  readonly cues?: Cues;
}

/**
 * Phase layout in time units. Accepts a flat record of phase values or a
 * structured `{ acts, cues }` object.
 */
export type PhaseConfig = FlatPhaseConfig | StructuredPhaseConfig;

/** Target window accepted by span(), phaseLocal(), phaseIn(), motion(), tween(), value(). */
export type PhaseSpanTarget<P extends string = string> =
  | P
  | readonly [P, P]
  | PhaseTimeWindow;

/** Shorthand easing names without the `ease` prefix (e.g. "outCubic", "inOutCubic"). */
export type ShorthandEasingName =
  | "inQuad"
  | "outQuad"
  | "inOutQuad"
  | "inSine"
  | "outSine"
  | "inOutSine"
  | "inCubic"
  | "outCubic"
  | "inOutCubic"
  | "inQuart"
  | "outQuart"
  | "inOutQuart"
  | "inQuint"
  | "outQuint"
  | "inOutQuint"
  | "inExpo"
  | "outExpo"
  | "inOutExpo"
  | "inCirc"
  | "outCirc"
  | "inOutCirc"
  | "inBack"
  | "outBack"
  | "inOutBack"
  | "inElastic"
  | "outElastic"
  | "inOutElastic"
  | "inBounce"
  | "outBounce"
  | "inOutBounce";

/** Semantic easing aliases mapped to craft defaults. */
export type SemanticEasing = "enter" | "exit" | "move" | "loop";

/**
 * Easing for motion and tween calls. Accepts:
 * - Named easing: `"easeOutCubic"`, `"easeInBack"`, etc.
 * - Shorthand easing: `"outCubic"`, `"inOutCubic"`, `"inBack"`, etc.
 * - Semantic: `"enter"` | `"exit"` | `"move"` | `"loop"`
 * - Spring name: `"gentle"` | `"playful"` | …
 * - Custom function: `(t: number) => number`
 * - Spring config: `{ stiffness: 180, damping: 18 }`
 */
export type MotionEasing =
  | EasingName
  | ShorthandEasingName
  | SemanticEasing
  | SpringName
  | EasingFn
  | SpringConfig;

/** Optional second arg to createDirector / ctx.director. */
export interface DirectorOpts {
  /** Motion tone — sets default enter pose + easings for motion(). */
  tone?: MotionTone;
  /** Optional acts map when configured via opts. */
  acts?: FlatPhaseConfig;
  /** Optional cues map when configured via opts. */
  cues?: FlatPhaseConfig;
}

export interface MotionOpts<P extends string = string> {
  /** Stable motion id — required for Media IR compile. */
  id?: string;
  /** Semantic node this motion targets. */
  target?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  fromOpacity?: number;

  during?: PhaseSpanTarget<P>;
  at?: string; // e.g. "0.28s" or "20%"
  /**
   * Enter window length ("0.5s" or "30%"). When omitted, omakase caps wall-clock
   * enter at ~375ms (or the full phase if shorter).
   */
  for?: string;
  window?: [start: number, end: number]; // absolute scene [0,1] fractions

  easing?: MotionEasing;
  /** Alias for `easing`. */
  ease?: MotionEasing;
  exitEasing?: MotionEasing;
  /** Alias for `exitEasing`. */
  exitEase?: MotionEasing;

  exit?: boolean | Partial<MotionOpts<P>>;
}

export interface MotionResult {
  // Structured values — compose these before serializing to CSS
  x: number;
  y: number;
  scale: number;
  rotate: number;
  blur: number;
  opacity: number;
  enter: number;
  exit: number;
  visible: boolean;
  phase: "before" | "entering" | "steady" | "exiting" | "after";

  // Derived CSS — built from the structured values above
  transform: string;
  filter: string;
  style: string;
}

/** Partial motion values for use with mergeMotion(). */
export type MotionValue = Partial<
  Pick<MotionResult, "x" | "y" | "scale" | "rotate" | "blur" | "opacity">
>;

export interface TweenOpts<P extends string = string> {
  /** Stable tween id — required for Media IR compile. */
  id?: string;
  target?: string;
  property?: string;
  during?: PhaseSpanTarget<P>;
  at?: string;
  for?: string;
  easing?: MotionEasing;
  /** Alias for `easing`. */
  ease?: MotionEasing;
  clamp?: boolean;
  pattern?: "linear" | "sine" | "pulse" | "bounce";
}

export interface ValueTweenOpts<P extends string = string> extends TweenOpts<P> {
  from?: number;
  to?: number;
}

export interface ValueOpts<P extends string = string> {
  fadeOn?: PhaseSpanTarget<P> | readonly (P | PhaseTimeWindow)[];
  during?: PhaseSpanTarget<P> | readonly (P | PhaseTimeWindow)[];
}

export interface ValueResult<T> {
  current: T;
  opacity: number;
}

export interface InOpts {
  /** Phase-local start offset ("0.5s", "500ms", or "25%") */
  at?: string;
  /** Window length ("1s", "500ms", or "50%"). Default: remainder of phase */
  duration?: string;
  /** Optional easing applied to the local progress. */
  ease?: MotionEasing;
  /** Alias for `ease`. */
  easing?: MotionEasing;
  /** Clamp progress to [0, 1] (default true). */
  clamp?: boolean;
}

export interface SpanOpts {
  /** Easing applied to the span progress. */
  ease?: MotionEasing;
  /** Alias for `ease`. */
  easing?: MotionEasing;
  /** Clamp progress to [0, 1] (default true). */
  clamp?: boolean;
}

export interface BeatsOpts<N extends string = string> {
  /** Phase that contains the tour. Omit for the whole scene. */
  during?: string | PhaseTimeWindow;
  /** Beat names, equal shares of the window. */
  of: readonly N[];
  /** Exit fraction of each beat used as the crossfade. Default `"8%"`. */
  cross?: string;
}

export type BeatState<N extends string = string> =
  | { crossing: false; name: N; local: number; index: number }
  | { crossing: true; from: N; to: N; mix: number; index: number };

export type DirectorPhases<P extends string = string> = Readonly<
  Record<P, NormalizedPhase>
> &
  readonly NormalizedPhase[];

export interface Director<P extends string = string> {
  readonly progress: number;
  readonly seconds: number;
  readonly active: P | "idle";
  /** Normalized phases (acts + cues) keyed by name and iterable in declaration order. */
  readonly phases: DirectorPhases<P>;
  /** Phase-local progress 0–1 (supports named phase, [startPhase, endPhase], or [startSec, endSec]). */
  in(phase: PhaseSpanTarget<P>, opts?: InOpts | MotionEasing): number;
  /** Alias for `in(phase, opts)`. */
  phaseIn(phase: PhaseSpanTarget<P>, opts?: InOpts | MotionEasing): number;
  /** Raw 0–1 local progress within a phase or [startSec, endSec] window. */
  phaseLocal(phase: PhaseSpanTarget<P>): number;
  /** Equal-share beats inside a phase. `cross` is the exit of a beat. */
  beats<N extends string>(opts: BeatsOpts<N>): BeatState<N>;
  /** Map phase progress → data timeline seconds (for keyframe charts, force, etc.). */
  at(phase: PhaseSpanTarget<P>, dataSeconds: number): number;
  /**
   * Progress 0–1 across a named phase/cue, `[startPhase, endPhase]`, inline `[startSec, endSec]`,
   * or legacy `(fromTimeStr, toTimeStr)`. Optionally accepts a shorthand easing or `{ ease, clamp }`.
   */
  span(target: PhaseSpanTarget<P>, easeOrOpts?: MotionEasing | SpanOpts): number;
  span(from: string, to: string, easeOrOpts?: MotionEasing | SpanOpts): number;
  /** Eased scene-absolute transition progress */
  transition(from: string, to: string, easing?: MotionEasing): number;
  /** True when scene time is strictly inside a span window */
  inSpan(from: string | PhaseSpanTarget<P>, to?: string): boolean;

  motion(opts?: MotionOpts<P>): MotionResult;
  tween(from: number, to: number, opts?: TweenOpts<P>): number;
  tween(opts: ValueTweenOpts<P>): number;
  value(opts: ValueTweenOpts<P>): number;
  value<T extends number | string>(v: T, opts?: ValueOpts<P>): ValueResult<T>;
  /** Nested timing window with local director() — Remotion-style sequence clips */
  clip(opts: ClipOpts): DirectorClip;
}

type ExtractPhaseNames<P> = P extends {
  readonly acts?: infer A;
  readonly cues?: infer C;
}
  ?
      | (A extends Record<string, unknown> ? Extract<keyof A, string> : never)
      | (C extends Record<string, unknown> ? Extract<keyof C, string> : never)
  : P extends Record<string, unknown>
    ? Extract<keyof P, string>
    : never;

export type DirectorOf<P extends PhaseConfig | undefined> = P extends PhaseConfig
  ? Director<[ExtractPhaseNames<P>] extends [never] ? string : ExtractPhaseNames<P>>
  : Director<"enter" | "hold" | "exit">;

/** Optional IR instrumentation hook (attached by resolveMediaIR, not author API). */
export interface DirectorInstrument {
  strictIds?: boolean;
  onIssue?(issue: {
    code: string;
    message: string;
    sceneId?: string;
    id?: string;
    frame?: number;
  }): void;
  sceneId?: string;
  frame?: number;
  sceneStartFrame?: number;
  totalFrames?: number;
  onDirector?(event: {
    sceneId: string;
    phases: { name: string; start: number; end: number }[];
    frame: number;
    sceneStartFrame: number;
    totalFrames: number;
  }): void;
  onMotion?(event: {
    localId: string;
    sceneId: string;
    kind: "motion" | "tween" | "value";
    target?: string;
    property?: string;
    enterStart: number;
    enterEnd: number;
    exitStart?: number;
    exitEnd?: number;
    from?: Record<string, number>;
    to?: Record<string, number>;
    exitTo?: Record<string, number>;
    easing?:
      | { kind: "named"; name: string }
      | { kind: "spring"; stiffness: number; damping: number; mass?: number };
    /** Effective exit easing after runtime mirror. */
    exitEasing?:
      | { kind: "named"; name: string }
      | { kind: "spring"; stiffness: number; damping: number; mass?: number };
    pattern?: "linear" | "sine" | "pulse" | "bounce";
    frame: number;
    sceneStartFrame: number;
    totalFrames: number;
  }): void;
}

/** Minimal surface createDirector() needs from the per-frame render context. */
export interface DirectorContext {
  timeline: Timeline;
  fps?: number;
  /** Internal IR sink — set by createRenderContext during resolveMediaIR. */
  instrument?: DirectorInstrument;
}

export interface ClipOpts {
  /** Named phase from the parent director layout, or inline [startSec, endSec] */
  during?: string | PhaseTimeWindow;
  /** Start offset relative to parent window ("0.5s", "500ms", or "25%") */
  from?: string;
  /** Clip length relative to parent window (required unless `during` is set) */
  duration?: string;
}

export interface DirectorClip {
  readonly active: boolean;
  readonly progress: number;
  readonly frame: number;
  readonly seconds: number;
  readonly durationSeconds: number;
  readonly totalFrames: number;
  director<P extends PhaseConfig | undefined = undefined>(phases?: P): DirectorOf<P>;
  clip(opts: ClipOpts): DirectorClip;
}

/** Normalized phase layout after percent/seconds/windows resolve to scene fractions 0–1. */
export interface NormalizedPhase {
  name: string;
  start: number;
  end: number;
  fraction: number;
  /** Normalized 0..1 fraction of totalDurationSeconds (Math.max(0, end - start)). */
  duration: number;
  /** Start time in seconds. */
  startSec: number;
  /** End time in seconds. */
  endSec: number;
  /** Optional discriminator when declared via structured `{ acts, cues }`. */
  kind?: "act" | "cue";
}
