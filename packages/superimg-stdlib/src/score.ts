/**
 * score() — unified scene-local timing primitive.
 *
 * Given a phase layout in seconds/percentages, returns an object for declaring
 * motions, tweens, and values scoped to those phases.
 *
 * ```ts
 * const t = std.score({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });
 * const card = t.motion();                            // auto enter + exit
 * const val  = t.motion({ y: 15, at: "0.1s" });       // stagger 0.1s into enter
 * const cnt  = t.tween(0, target, { during: "enter" });
 * const bar  = t.value(value / target, { fadeOn: "exit" });
 * ```
 */

import { clamp01, type EasingFn, type EasingName } from "./easing.js";
import { interpolate } from "./interpolate.js";
import * as easing from "./easing.js";
import { lerp } from "./math.js";
import { type SpringConfig, springCurve } from "./spring.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Phase layout in time units. Values are duration strings ("0.6s", "600ms")
 * or percentages ("15%") of the scene duration. Must sum to <= 100% / scene.
 */
export type PhaseConfig = Record<string, string>;

/**
 * Easing for motion and tween calls. Accepts:
 * - Named easing: `"easeOutCubic"`, `"easeInBack"`, etc.
 * - Custom function: `(t: number) => number`
 * - Spring config: `{ stiffness: 180, damping: 18 }`
 */
export type MotionEasing = EasingName | EasingFn | SpringConfig;

export interface MotionOpts<P extends string = string> {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  fromOpacity?: number;

  during?: P;
  at?: number | string;  // fraction of phase OR absolute time e.g. "0.28s"
  for?: number | string; // fraction of phase OR absolute time e.g. "0.5s"
  window?: [start: number, end: number]; // absolute scene [0,1] fractions

  easing?: MotionEasing;
  exitEasing?: MotionEasing;

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
export type MotionValue = Partial<Pick<MotionResult, "x" | "y" | "scale" | "rotate" | "blur" | "opacity">>;

export interface TweenOpts<P extends string = string> {
  during?: P;
  at?: number | string;
  for?: number | string;
  easing?: MotionEasing;
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

export interface WithinOpts {
  /** Phase-local start offset (0–1 fraction, or "0.5s") */
  at?: number | string;
  /** Window length (0–1 fraction of phase, or "1s"). Default: remainder of phase */
  duration?: number | string;
}

export interface Score<P extends string = string> {
  readonly progress: number;
  readonly seconds: number;
  readonly active: P | "idle";
  within(phase: P, opts?: WithinOpts): number;
  /** Scene-absolute progress from `from` to `to` (e.g. span("0s", "1s")) */
  span(from: string, to: string): number;
  /** Eased scene-absolute transition progress (alias for interpolate(span(...), [0,1], [0,1], easing)) */
  transition(from: string, to: string, easing?: EasingName | EasingFn): number;
  /** True when scene time is strictly inside a span window */
  inSpan(from: string, to: string): boolean;

  motion(opts?: MotionOpts<P>): MotionResult;
  tween(from: number, to: number, opts?: TweenOpts<P>): number;
  value<T extends number | string>(v: T, opts?: ValueOpts<P>): ValueResult<T>;
}

export type ScoreOf<P extends PhaseConfig | undefined> =
  P extends PhaseConfig
    ? Score<Extract<keyof P, string>>
    : Score<"enter" | "hold" | "exit">;

/** Minimal surface score() needs from the per-frame render context. */
export interface ScoreContext {
  sceneProgress: number;
  sceneTimeSeconds: number;
  sceneDurationSeconds: number;
}


// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_PHASES: PhaseConfig = { enter: "15%", hold: "70%", exit: "15%" };
const DEFAULT_ENTER_EASING: EasingFn = easing.easeOutCubic;
const DEFAULT_EXIT_EASING: EasingFn = easing.easeInCubic;

// -----------------------------------------------------------------------------
// Easing
// -----------------------------------------------------------------------------

const NAMED_EASINGS: Record<string, EasingFn> = {
  linear: easing.linear,
  easeInQuad: easing.easeInQuad,     easeOutQuad: easing.easeOutQuad,     easeInOutQuad: easing.easeInOutQuad,
  easeInSine: easing.easeInSine,     easeOutSine: easing.easeOutSine,     easeInOutSine: easing.easeInOutSine,
  easeInCubic: easing.easeInCubic,   easeOutCubic: easing.easeOutCubic,   easeInOutCubic: easing.easeInOutCubic,
  easeInQuart: easing.easeInQuart,   easeOutQuart: easing.easeOutQuart,   easeInOutQuart: easing.easeInOutQuart,
  easeInQuint: easing.easeInQuint,   easeOutQuint: easing.easeOutQuint,   easeInOutQuint: easing.easeInOutQuint,
  easeInExpo: easing.easeInExpo,     easeOutExpo: easing.easeOutExpo,     easeInOutExpo: easing.easeInOutExpo,
  easeInCirc: easing.easeInCirc,     easeOutCirc: easing.easeOutCirc,     easeInOutCirc: easing.easeInOutCirc,
  easeInBack: easing.easeInBack,     easeOutBack: easing.easeOutBack,     easeInOutBack: easing.easeInOutBack,
  easeInElastic: easing.easeInElastic, easeOutElastic: easing.easeOutElastic, easeInOutElastic: easing.easeInOutElastic,
  easeInBounce: easing.easeInBounce, easeOutBounce: easing.easeOutBounce, easeInOutBounce: easing.easeInOutBounce,
};

const EXIT_MIRROR: Record<string, EasingFn> = {
  easeOutQuad: easing.easeInQuad,       easeOutCubic: easing.easeInCubic,
  easeOutQuart: easing.easeInQuart,     easeOutQuint: easing.easeInQuint,
  easeOutSine: easing.easeInSine,       easeOutExpo: easing.easeInExpo,
  easeOutCirc: easing.easeInCirc,       easeOutBack: easing.easeInQuad,
  easeOutElastic: easing.easeInQuad,    easeOutBounce: easing.easeInQuad,
  easeInOutQuad: easing.easeInOutQuad,  easeInOutCubic: easing.easeInOutCubic,
  easeInOutQuart: easing.easeInOutQuart, easeInOutSine: easing.easeInOutSine,
  easeInOutExpo: easing.easeInOutExpo,
};

function resolveEasing(spec: MotionEasing | undefined, fallback: EasingFn): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "function") return spec;
  if (typeof spec === "object") return (t: number) => springCurve(t, spec);
  const fn = NAMED_EASINGS[spec];
  if (!fn) throw new Error(`Unknown easing: "${spec}"`);
  return fn;
}

function mirrorExitEasing(spec: MotionEasing | undefined, fallback: EasingFn): EasingFn {
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

function parsePhaseDuration(value: string, totalSeconds: number): number {
  const s = value.trim();
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    if (!Number.isFinite(pct) || pct <= 0)
      throw new Error(`score(): invalid phase "%": "${value}"`);
    return pct / 100;
  }
  if (s.endsWith("ms")) {
    const ms = parseFloat(s);
    if (!Number.isFinite(ms) || ms <= 0)
      throw new Error(`score(): invalid phase duration: "${value}"`);
    return ms / 1000 / totalSeconds;
  }
  if (s.endsWith("s")) {
    const sec = parseFloat(s);
    if (!Number.isFinite(sec) || sec <= 0)
      throw new Error(`score(): invalid phase duration: "${value}"`);
    return sec / totalSeconds;
  }
  throw new Error(`score(): phase "${value}" must end with "s", "ms", or "%" (e.g. "0.6s", "15%")`);
}

function normalizePhases(cfg: PhaseConfig, totalSeconds: number): NormalizedPhase[] {
  const entries = Object.entries(cfg);
  if (entries.length === 0) throw new Error("score(): phase layout must have at least one phase");
  const fractions = entries.map(([name, v]) => ({ name, fraction: parsePhaseDuration(v, totalSeconds) }));
  const total = fractions.reduce((s, f) => s + f.fraction, 0);
  if (total > 1.0000001)
    throw new Error(`score(): phases sum to ${(total * 100).toFixed(1)}% which exceeds 100%`);
  let acc = 0;
  return fractions.map(({ name, fraction }) => {
    const start = acc;
    const end = acc + fraction;
    acc = end;
    return { name, start, end, fraction };
  });
}

/** Convert an at/for value to a scene-fraction offset within the phase. */
function parseMotionTime(value: number | string, phaseSpan: number, totalSeconds: number): number {
  if (typeof value === "number") return value * phaseSpan;
  const s = value.trim();
  if (s.endsWith("ms")) return parseFloat(s) / 1000 / totalSeconds;
  if (s.endsWith("s")) return parseFloat(s) / totalSeconds;
  throw new Error(`score(): time "${value}" must be "Xs" or "Xms"`);
}

// -----------------------------------------------------------------------------
// Style assembly
// -----------------------------------------------------------------------------

function approxZero(v: number): boolean { return Math.abs(v) < 1e-4; }

function buildTransform(x: number, y: number, scale: number, rotate: number): string {
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

function buildStyle(opacity: number, transform: string, filter: string): string {
  const parts = [`opacity:${opacity}`];
  if (transform) parts.push(`transform:${transform}`);
  if (filter) parts.push(`filter:${filter}`);
  return parts.join(";");
}

function makeResult(
  x: number, y: number, scale: number, rotate: number, blur: number,
  opacity: number, enter: number, exitEased: number,
): MotionResult {
  let phase: MotionResult["phase"];
  if (enter <= 0) phase = "before";
  else if (exitEased >= 1) phase = "after";
  else if (exitEased > 0) phase = "exiting";
  else if (enter < 1) phase = "entering";
  else phase = "steady";
  const transform = buildTransform(x, y, scale, rotate);
  const filter = buildFilter(blur);
  return { x, y, scale, rotate, blur, opacity, enter, exit: exitEased,
    visible: enter > 0 && exitEased < 1, phase, transform, filter,
    style: buildStyle(opacity, transform, filter) };
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

export function createScore<P extends PhaseConfig | undefined = undefined>(
  ctx: ScoreContext,
  phases?: P,
): ScoreOf<P> {
  const cfg = (phases ?? DEFAULT_PHASES) as PhaseConfig;
  const totalSeconds = ctx.sceneDurationSeconds > 0 ? ctx.sceneDurationSeconds : 1;
  const ordered = normalizePhases(cfg, totalSeconds);
  const phaseMap = new Map<string, NormalizedPhase>(ordered.map((p) => [p.name, p]));
  const sp = ctx.sceneProgress;
  const secs = ctx.sceneTimeSeconds;

  const firstPhase = ordered[0]!;
  const lastPhase = ordered[ordered.length - 1]!;

  const activeName: string = (() => {
    if (sp >= 1) return lastPhase.name;
    for (const p of ordered) if (sp >= p.start && sp < p.end) return p.name;
    return "idle";
  })();

  function phaseOf(name: string): NormalizedPhase {
    const p = phaseMap.get(name);
    if (!p) throw new Error(
      `score: unknown phase "${name}". Known: ${ordered.map((o) => o.name).join(", ")}`
    );
    return p;
  }

  function phaseLocal(name: string): number {
    const p = phaseOf(name);
    if (p.start === p.end) return sp >= p.start ? 1 : 0;
    return clamp01((sp - p.start) / (p.end - p.start));
  }

  function within(name: string, opts?: WithinOpts): number {
    const local = phaseLocal(name);
    if (!opts) return local;

    const phase = phaseOf(name);
    const span = phase.end - phase.start;
    const atLocal = opts.at !== undefined
      ? (typeof opts.at === "number" ? opts.at : parseMotionTime(opts.at, span, totalSeconds) / span)
      : 0;
    const durLocal = opts.duration !== undefined
      ? (typeof opts.duration === "number" ? opts.duration : parseMotionTime(opts.duration, span, totalSeconds) / span)
      : 1 - atLocal;

    if (local <= atLocal) return 0;
    if (local >= atLocal + durLocal) return 1;
    return clamp01((local - atLocal) / durLocal);
  }

  function span(from: string, to: string): number {
    const start = parseMotionTime(from, 1, totalSeconds);
    const end = parseMotionTime(to, 1, totalSeconds);
    if (sp <= start) return 0;
    if (sp >= end) return 1;
    return clamp01((sp - start) / (end - start));
  }

  function transition(from: string, to: string, easing?: EasingName | EasingFn): number {
    const raw = span(from, to);
    if (!easing) return raw;
    return interpolate(raw, [0, 1], [0, 1], easing);
  }

  function inSpan(from: string, to: string): boolean {
    const raw = span(from, to);
    return raw > 0 && raw < 1;
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
      for: forOpt = 1,
      window,
      easing: easingSpec,
      exitEasing: exitEasingSpec,
      exit = true,
    } = opts;

    // Enter window
    let enterStart: number, enterEnd: number;
    if (window) {
      [enterStart, enterEnd] = window;
    } else {
      const phase = during ? phaseOf(during) : firstPhase;
      const span = phase.end - phase.start;
      const atFrac = parseMotionTime(at, span, totalSeconds);
      const forFrac = parseMotionTime(forOpt, span, totalSeconds);
      enterStart = phase.start + atFrac;
      enterEnd = enterStart + forFrac;
    }
    const enterSpan = enterEnd - enterStart;
    const enterRaw = enterSpan <= 0 ? (sp >= enterStart ? 1 : 0)
      : clamp01((sp - enterStart) / enterSpan);
    const enterEasingFn = resolveEasing(easingSpec, DEFAULT_ENTER_EASING);
    const enter = enterEasingFn(enterRaw);

    // Exit window + pose
    const exitOff = exit === false;
    const exitOpts: Partial<MotionOpts> = typeof exit === "object" ? exit : {};
    let exitStart: number, exitEnd: number, exitActive: boolean;
    if (exitOff) {
      exitActive = false; exitStart = 0; exitEnd = 0;
    } else if (exitOpts.window) {
      [exitStart, exitEnd] = exitOpts.window; exitActive = true;
    } else if (ordered.length >= 2 && lastPhase.name !== firstPhase.name) {
      exitStart = lastPhase.start; exitEnd = lastPhase.end; exitActive = true;
    } else {
      exitActive = false; exitStart = 0; exitEnd = 0;
    }
    const exitSpan = exitEnd - exitStart;
    const exitRaw = !exitActive || exitSpan <= 0 ? 0
      : clamp01((sp - exitStart) / exitSpan);
    const exitEasingFn = mirrorExitEasing(exitEasingSpec ?? easingSpec, DEFAULT_EXIT_EASING);
    const exitEased = exitEasingFn(exitRaw);

    const exitToX = exitOpts.x ?? -startX;
    const exitToY = exitOpts.y ?? -startY;
    const exitToScale = exitOpts.scale ?? startScale;
    const exitToRotate = exitOpts.rotate ?? -startRotate;
    const exitToBlur = exitOpts.blur ?? startBlur;

    const ax = lerp(lerp(startX, 0, enter), exitToX, exitEased);
    const ay = lerp(lerp(startY, 0, enter), exitToY, exitEased);
    const aScale = lerp(lerp(startScale, 1, enter), exitToScale, exitEased);
    const aRotate = lerp(lerp(startRotate, 0, enter), exitToRotate, exitEased);
    const aBlur = lerp(lerp(startBlur, 0, enter), exitToBlur, exitEased);
    const opacity = lerp(fromOpacity, 1, enter) * (1 - exitEased);

    return makeResult(ax, ay, aScale, aRotate, aBlur, opacity, enter, exitEased);
  }

  function tween(from: number, to: number, opts: TweenOpts = {}): number {
    const { during, at = 0, for: forOpt = 1, easing: easingSpec, pattern } = opts;
    const phase = during ? phaseOf(during) : firstPhase;
    const span = phase.end - phase.start;
    const atFrac = parseMotionTime(at, span, totalSeconds);
    const forFrac = parseMotionTime(forOpt, span, totalSeconds);
    const localStart = phase.start + atFrac;
    const localEnd = localStart + forFrac;
    const localSpan = localEnd - localStart;
    const raw = localSpan <= 0 ? (sp >= localStart ? 1 : 0)
      : clamp01((sp - localStart) / localSpan);

    let eased: number;
    if (pattern === "sine") eased = Math.sin(raw * Math.PI);
    else if (pattern === "pulse") eased = 0.5 + 0.5 * Math.sin(raw * Math.PI * 6 - Math.PI / 2);
    else if (pattern === "bounce") eased = easing.easeOutBounce(raw);
    else if (pattern === "linear") eased = raw;
    else eased = resolveEasing(easingSpec, DEFAULT_ENTER_EASING)(raw);
    return lerp(from, to, eased);
  }

  function value<T extends number | string>(v: T, opts: ValueOpts = {}): ValueResult<T> {
    let opacity = 1;
    if (opts.during) {
      const names = Array.isArray(opts.during) ? (opts.during as string[]) : [opts.during as string];
      if (!names.some((n) => { const p = phaseOf(n); return sp >= p.start && sp < p.end; }))
        opacity = 0;
    }
    if (opts.fadeOn) {
      const names = Array.isArray(opts.fadeOn) ? (opts.fadeOn as string[]) : [opts.fadeOn as string];
      for (const n of names) {
        const p = phaseOf(n);
        if (sp >= p.start) {
          const span = p.end - p.start;
          opacity *= 1 - (span <= 0 ? 1 : clamp01((sp - p.start) / span));
        }
      }
    }
    return { current: v, opacity };
  }

  const result: Score = {
    progress: sp,
    seconds: secs,
    active: activeName,
    within,
    span,
    transition,
    inSpan,
    motion,
    tween,
    value,
  };
  return result as unknown as ScoreOf<P>;
}

/**
 * The public `score()` runtime stub. `std.score()` on `ctx.std` is a
 * bound variant created per-render by the stdlib assembler. Importing and
 * calling `createScore(ctx, phases)` directly also works.
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

/**
 * Merge multiple motion values into a single MotionResult.
 * Last-wins per property; transforms combine into one CSS string.
 *
 * @example
 * const card = t.motion({ y: 20 });
 * const idle = { scale: std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 }) };
 * return `<div style="${std.css(std.mergeMotion(card, idle))}">`;
 */
export function mergeMotion(...motions: Array<MotionValue | MotionResult>): MotionResult {
  let x = 0, y = 0, scale = 1, rotate = 0, blur = 0, opacity = 1;
  let enter = 1, exitVal = 0;
  let visible = true;
  let phase: MotionResult["phase"] = "steady";

  for (const m of motions) {
    if (m.x !== undefined) x = m.x;
    if (m.y !== undefined) y = m.y;
    if (m.scale !== undefined) scale = m.scale;
    if (m.rotate !== undefined) rotate = m.rotate;
    if (m.blur !== undefined) blur = m.blur;
    if (m.opacity !== undefined) opacity = m.opacity;
    const r = m as MotionResult;
    if (r.enter !== undefined) enter = r.enter;
    if (r.exit !== undefined) exitVal = r.exit;
    if (r.visible !== undefined) visible = r.visible;
    if (r.phase !== undefined) phase = r.phase;
  }

  const transform = buildTransform(x, y, scale, rotate);
  const filter = buildFilter(blur);
  return { x, y, scale, rotate, blur, opacity, enter, exit: exitVal,
    visible, phase, transform, filter, style: buildStyle(opacity, transform, filter) };
}
