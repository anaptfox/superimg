/**
 * score() — unified scene-local timing primitive.
 *
 * Given a phase layout, returns an object for declaring motions, tweens, and
 * values scoped to those phases with auto enter + auto exit and stagger.
 * See `packages/superimg-stdlib/DESIGN_score.md` for the full design.
 *
 * ```ts
 * const t = std.score({ enter: 0.15, hold: 0.70, exit: 0.15 });
 * const card = t.motion();                       // auto enter + exit
 * const val  = t.motion({ y: 15, at: 0.15 });    // stagger in enter phase
 * const cnt  = t.tween(0, target, { during: "enter" });
 * const bar  = t.value(value / target, { fadeOn: "exit" });
 * ```
 */

import { clamp01 } from "./easing.js";
import * as easing from "./easing.js";
import type { EasingFn } from "./tween.js";
import { lerp } from "./math.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Phase layout. Values are fractions of the scene (0..1). Must sum to <= 1. */
export type PhaseConfig = Record<string, number>;

/** Default phase split used when `std.score()` is called with no argument. */
export interface DefaultPhases {
  enter: 0.15;
  hold: 0.7;
  exit: 0.15;
}

/** Named easing or a custom function that maps [0,1] → [0,1]. */
export type EasingSpec =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInQuart"
  | "easeOutQuart"
  | "easeInOutQuart"
  | "easeInExpo"
  | "easeOutExpo"
  | "easeOutBack"
  | "easeOutElastic"
  | "easeOutBounce"
  | "spring"
  | `spring(${number},${number})`
  | ((t: number) => number);

export interface MotionOpts<P extends string = string> {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  fromOpacity?: number;

  during?: P;
  at?: number;
  duration?: number;
  window?: [start: number, end: number];

  easing?: EasingSpec;
  exitEasing?: EasingSpec;

  exit?: boolean | Partial<MotionOpts<P>>;
}

export interface MotionResult {
  enter: number;
  exit: number;
  visible: boolean;
  phase: "before" | "entering" | "steady" | "exiting" | "after";

  opacity: number;
  transform: string;
  filter: string;

  style: string;
}

export interface TweenOpts<P extends string = string> {
  during?: P;
  at?: number;
  duration?: number;
  easing?: EasingSpec;
  pattern?: "linear" | "sine" | "pulse" | "bounce";
}

export interface ValueOpts<P extends string = string> {
  fadeOn?: P | readonly P[];
  during?: P | readonly P[];
}

export interface ValueResult<T> {
  current: T;
  opacity: number;
}

export interface Score<P extends string = string> {
  readonly progress: number;
  readonly seconds: number;
  readonly active: P | "idle";
  within(phase: P): number;

  motion(opts?: MotionOpts<P>): MotionResult;
  tween(from: number, to: number, opts?: TweenOpts<P>): number;
  value<T extends number | string>(v: T, opts?: ValueOpts<P>): ValueResult<T>;
}

export type ScoreOf<P extends PhaseConfig | undefined> =
  P extends PhaseConfig
    ? Score<Extract<keyof P, string>>
    : Score<Extract<keyof DefaultPhases, string>>;

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_PHASES: PhaseConfig = { enter: 0.15, hold: 0.7, exit: 0.15 };
const DEFAULT_ENTER_EASING: EasingFn = easing.easeOutCubic;
const DEFAULT_EXIT_EASING: EasingFn = easing.easeInCubic;

// -----------------------------------------------------------------------------
// Easing resolution — combines named, spring, and function specs
// -----------------------------------------------------------------------------

const NAMED_EASINGS: Record<string, EasingFn> = {
  linear: easing.linear,
  easeIn: easing.easeInCubic,
  easeOut: easing.easeOutCubic,
  easeInOut: easing.easeInOutCubic,
  easeInQuad: easing.easeInQuad,
  easeOutQuad: easing.easeOutQuad,
  easeInOutQuad: easing.easeInOutQuad,
  easeInCubic: easing.easeInCubic,
  easeOutCubic: easing.easeOutCubic,
  easeInOutCubic: easing.easeInOutCubic,
  easeInQuart: easing.easeInQuart,
  easeOutQuart: easing.easeOutQuart,
  easeInOutQuart: easing.easeInOutQuart,
  easeInExpo: easing.easeInExpo,
  easeOutExpo: easing.easeOutExpo,
  easeOutBack: easing.easeOutBack,
  easeOutElastic: easing.easeOutElastic,
  easeOutBounce: easing.easeOutBounce,
};

// Mirrors an enter easing to a natural exit counterpart.
const EXIT_MIRROR: Record<string, EasingFn> = {
  easeOut: easing.easeInCubic,
  easeOutQuad: easing.easeInQuad,
  easeOutCubic: easing.easeInCubic,
  easeOutQuart: easing.easeInQuart,
  easeOutExpo: easing.easeInExpo,
  easeOutBack: easing.easeInQuad,
  easeOutElastic: easing.easeInQuad,
  easeOutBounce: easing.easeInQuad,
  easeInOut: easing.easeInOutCubic,
  easeInOutQuad: easing.easeInOutQuad,
  easeInOutCubic: easing.easeInOutCubic,
  easeInOutQuart: easing.easeInOutQuart,
};

const SPRING_RE = /^spring\(([\d.]+),\s*([\d.]+)\)$/;

function makeSpring(stiffness: number, damping: number): EasingFn {
  // Simple critically-damped-ish spring approximation in [0, 1].
  // Not physically accurate; produces a single overshoot for k>50 d<20.
  const omega = Math.sqrt(Math.max(stiffness, 1));
  const zeta = damping / (2 * Math.sqrt(Math.max(stiffness, 1)));
  return (t: number) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    if (zeta < 1) {
      const wd = omega * Math.sqrt(Math.max(1 - zeta * zeta, 1e-6));
      const decay = Math.exp(-zeta * omega * x);
      return 1 - decay * Math.cos(wd * x);
    }
    return 1 - Math.exp(-omega * x) * (1 + omega * x);
  };
}

function resolveEasing(
  spec: EasingSpec | undefined,
  fallback: EasingFn,
): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "function") return spec;
  if (spec === "spring") return makeSpring(180, 18);
  const m = SPRING_RE.exec(spec);
  if (m) return makeSpring(Number(m[1]), Number(m[2]));
  const fn = NAMED_EASINGS[spec];
  if (!fn) throw new Error(`Unknown easing: ${spec}`);
  return fn;
}

function mirrorExitEasing(
  spec: EasingSpec | undefined,
  fallback: EasingFn,
): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "string") {
    const mirrored = EXIT_MIRROR[spec];
    if (mirrored) return mirrored;
  }
  return resolveEasing(spec, fallback);
}

// -----------------------------------------------------------------------------
// Phase normalization
// -----------------------------------------------------------------------------

interface NormalizedPhase {
  name: string;
  start: number;
  end: number;
  fraction: number;
}

function normalizePhases(cfg: PhaseConfig): NormalizedPhase[] {
  const entries = Object.entries(cfg);
  if (entries.length === 0) {
    throw new Error("score(): phase layout must have at least one phase");
  }
  let total = 0;
  for (const [name, fraction] of entries) {
    if (!Number.isFinite(fraction) || fraction <= 0) {
      throw new Error(
        `score(): phase "${name}" has invalid fraction ${fraction}; must be > 0`,
      );
    }
    total += fraction;
  }
  if (total > 1.0000001) {
    throw new Error(
      `score(): phase fractions must sum to <= 1 (got ${total.toFixed(3)})`,
    );
  }

  let acc = 0;
  return entries.map(([name, fraction]) => {
    const start = acc;
    const end = acc + fraction;
    acc = end;
    return { name, start, end, fraction };
  });
}

// -----------------------------------------------------------------------------
// Style assembly
// -----------------------------------------------------------------------------

function approxZero(v: number): boolean {
  return Math.abs(v) < 1e-4;
}

function buildTransform(
  x: number,
  y: number,
  scale: number,
  rotate: number,
): string {
  const parts: string[] = [];
  if (!approxZero(x)) parts.push(`translateX(${x}px)`);
  if (!approxZero(y)) parts.push(`translateY(${y}px)`);
  if (!approxZero(scale - 1)) parts.push(`scale(${scale})`);
  if (!approxZero(rotate)) parts.push(`rotate(${rotate}deg)`);
  return parts.join(" ");
}

function buildFilter(blur: number): string {
  return !approxZero(blur) ? `blur(${blur}px)` : "";
}

function buildStyle(
  opacity: number,
  transform: string,
  filter: string,
): string {
  const parts: string[] = [`opacity:${opacity}`];
  if (transform) parts.push(`transform:${transform}`);
  if (filter) parts.push(`filter:${filter}`);
  return parts.join(";");
}

// -----------------------------------------------------------------------------
// RenderContext bridge (avoids a circular type import)
// -----------------------------------------------------------------------------

/** Minimal surface score() needs from the per-frame render context. */
export interface ScoreContext {
  sceneProgress: number;
  sceneTimeSeconds: number;
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

export function createScore<P extends PhaseConfig | undefined = undefined>(
  ctx: ScoreContext,
  phases?: P,
): ScoreOf<P> {
  const cfg = (phases ?? DEFAULT_PHASES) as PhaseConfig;
  const ordered = normalizePhases(cfg);
  const phaseMap = new Map<string, NormalizedPhase>(
    ordered.map((p) => [p.name, p]),
  );
  const sp = ctx.sceneProgress;
  const secs = ctx.sceneTimeSeconds;

  const firstPhase = ordered[0]!;
  const lastPhase = ordered[ordered.length - 1]!;

  const activeName: string = (() => {
    if (sp >= 1) return lastPhase.name;
    for (const p of ordered) {
      if (sp >= p.start && sp < p.end) return p.name;
    }
    return "idle";
  })();

  function within(name: string): number {
    const p = phaseMap.get(name);
    if (!p) {
      throw new Error(
        `score.within(): unknown phase "${name}". Known: ${ordered
          .map((o) => o.name)
          .join(", ")}`,
      );
    }
    if (p.start === p.end) return sp >= p.start ? 1 : 0;
    return clamp01((sp - p.start) / (p.end - p.start));
  }

  function phaseOf(name: string): NormalizedPhase {
    const p = phaseMap.get(name);
    if (!p) {
      throw new Error(
        `score: unknown phase "${name}". Known: ${ordered
          .map((o) => o.name)
          .join(", ")}`,
      );
    }
    return p;
  }

  function motion(opts: MotionOpts = {}): MotionResult {
    const {
      x: startX = 0,
      y: startY = 20,
      scale: startScale = 1,
      rotate: startRotate = 0,
      blur: startBlur = 0,
      fromOpacity = 0,
      during,
      at = 0,
      duration = 1,
      window,
      easing: easingSpec,
      exitEasing: exitEasingSpec,
      exit = true,
    } = opts;

    // --- Enter window ---
    let enterStart: number;
    let enterEnd: number;
    if (window) {
      [enterStart, enterEnd] = window;
    } else {
      const phase = during ? phaseOf(during) : firstPhase;
      const span = phase.end - phase.start;
      const localStart = at * span;
      enterStart = phase.start + localStart;
      enterEnd = enterStart + duration * span;
    }
    const enterSpan = enterEnd - enterStart;
    const enterRaw =
      enterSpan <= 0
        ? sp >= enterStart
          ? 1
          : 0
        : clamp01((sp - enterStart) / enterSpan);

    const enterEasingFn = resolveEasing(easingSpec, DEFAULT_ENTER_EASING);
    const enter = enterEasingFn(enterRaw);

    // --- Exit window + pose ---
    const exitOff = exit === false;
    const exitOpts: Partial<MotionOpts> =
      typeof exit === "object" ? exit : {};

    let exitStart: number;
    let exitEnd: number;
    let exitActive: boolean;
    if (exitOff) {
      exitActive = false;
      exitStart = 0;
      exitEnd = 0;
    } else if (exitOpts.window) {
      [exitStart, exitEnd] = exitOpts.window;
      exitActive = true;
    } else if (ordered.length >= 2 && lastPhase.name !== firstPhase.name) {
      exitStart = lastPhase.start;
      exitEnd = lastPhase.end;
      exitActive = true;
    } else {
      exitActive = false;
      exitStart = 0;
      exitEnd = 0;
    }

    const exitSpan = exitEnd - exitStart;
    const exitRaw =
      !exitActive || exitSpan <= 0
        ? 0
        : clamp01((sp - exitStart) / exitSpan);

    const exitEasingFn = mirrorExitEasing(
      exitEasingSpec ?? easingSpec,
      DEFAULT_EXIT_EASING,
    );
    const exitEased = exitEasingFn(exitRaw);

    // Exit pose defaults: mirror the enter start (negate translations + rotation).
    const exitToX = exitOpts.x ?? -startX;
    const exitToY = exitOpts.y ?? -startY;
    const exitToScale = exitOpts.scale ?? startScale;
    const exitToRotate = exitOpts.rotate ?? -startRotate;
    const exitToBlur = exitOpts.blur ?? startBlur;

    // Compose pose: start → rest (via enter), then rest → exit pose (via exit)
    const afterEnterX = lerp(startX, 0, enter);
    const afterEnterY = lerp(startY, 0, enter);
    const afterEnterScale = lerp(startScale, 1, enter);
    const afterEnterRotate = lerp(startRotate, 0, enter);
    const afterEnterBlur = lerp(startBlur, 0, enter);

    const finalX = lerp(afterEnterX, exitToX, exitEased);
    const finalY = lerp(afterEnterY, exitToY, exitEased);
    const finalScale = lerp(afterEnterScale, exitToScale, exitEased);
    const finalRotate = lerp(afterEnterRotate, exitToRotate, exitEased);
    const finalBlur = lerp(afterEnterBlur, exitToBlur, exitEased);

    const enterOpacity = lerp(fromOpacity, 1, enter);
    const opacity = enterOpacity * (1 - exitEased);

    const visible = enter > 0 && exitEased < 1;
    let phase: MotionResult["phase"];
    if (enter <= 0) phase = "before";
    else if (exitEased >= 1) phase = "after";
    else if (exitEased > 0) phase = "exiting";
    else if (enter < 1) phase = "entering";
    else phase = "steady";

    const transform = buildTransform(finalX, finalY, finalScale, finalRotate);
    const filter = buildFilter(finalBlur);
    const style = buildStyle(opacity, transform, filter);

    return {
      enter,
      exit: exitEased,
      visible,
      phase,
      opacity,
      transform,
      filter,
      style,
    };
  }

  function tween(from: number, to: number, opts: TweenOpts = {}): number {
    const {
      during,
      at = 0,
      duration = 1,
      easing: easingSpec,
      pattern,
    } = opts;

    const phase = during ? phaseOf(during) : firstPhase;
    const span = phase.end - phase.start;
    const localStart = phase.start + at * span;
    const localEnd = localStart + duration * span;
    const localSpan = localEnd - localStart;
    const raw =
      localSpan <= 0
        ? sp >= localStart
          ? 1
          : 0
        : clamp01((sp - localStart) / localSpan);

    let eased: number;
    if (pattern === "sine") {
      eased = Math.sin(raw * Math.PI);
    } else if (pattern === "pulse") {
      eased = 0.5 + 0.5 * Math.sin(raw * Math.PI * 6 - Math.PI / 2);
    } else if (pattern === "bounce") {
      eased = easing.easeOutBounce(raw);
    } else if (pattern === "linear") {
      eased = raw;
    } else {
      eased = resolveEasing(easingSpec, DEFAULT_ENTER_EASING)(raw);
    }
    return lerp(from, to, eased);
  }

  function value<T extends number | string>(
    v: T,
    opts: ValueOpts = {},
  ): ValueResult<T> {
    let opacity = 1;

    if (opts.during) {
      const names = Array.isArray(opts.during)
        ? (opts.during as string[])
        : [opts.during as string];
      const anyActive = names.some((name) => {
        const p = phaseOf(name);
        return sp >= p.start && sp < p.end;
      });
      if (!anyActive) opacity = 0;
    }

    if (opts.fadeOn) {
      const names = Array.isArray(opts.fadeOn)
        ? (opts.fadeOn as string[])
        : [opts.fadeOn as string];
      for (const name of names) {
        const p = phaseOf(name);
        if (sp >= p.start) {
          const span = p.end - p.start;
          const local = span <= 0 ? 1 : clamp01((sp - p.start) / span);
          opacity *= 1 - local;
        }
      }
    }

    return { current: v, opacity };
  }

  const score: Score = {
    progress: sp,
    seconds: secs,
    active: activeName,
    within,
    motion,
    tween,
    value,
  };

  return score as unknown as ScoreOf<P>;
}

/**
 * The public `score()` runtime stub. `std.score()` on `ctx.std` is a bound
 * variant of this factory created per-render by the stdlib assembler. Importing
 * this directly works too if you pass an object with `sceneProgress` +
 * `sceneTimeSeconds`.
 */
export function score<P extends PhaseConfig | undefined = undefined>(
  this: ScoreContext | void,
  phases?: P,
): ScoreOf<P> {
  if (this && typeof this.sceneProgress === "number") {
    return createScore(this, phases);
  }
  throw new Error(
    "score(): must be invoked through ctx.std.score() — the stdlib binds it to the render context. " +
      "For direct use, call createScore(ctx, phases).",
  );
}
