/**
 * director() — unified scene-local timing primitive.
 *
 * Given a phase layout in seconds/percentages, returns an object for declaring
 * motions, tweens, and values scoped to those phases.
 *
 * ```ts
 * const t = ctx.director({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });
 * const card = t.motion();                            // auto enter + exit
 * const val  = t.motion({ y: 15, at: "0.1s" });       // stagger 0.1s into enter
 * const cnt  = t.tween(0, target, { during: "enter" });
 * const bar  = t.value(value / target, { fadeOn: "exit" });
 * ```
 */

import type { Timeline } from "@superimg/types";
import { clamp01, type EasingFn, type EasingName } from "./easing.js";
import { interpolate } from "./interpolate.js";
import * as easing from "./easing.js";
import { lerp } from "./math.js";
import {
  type SpringConfig,
  type SpringName,
  isSpringName,
  resolveSpring,
  springCurve,
} from "./spring.js";
import {
  type MotionTone,
  getMotionTone,
  type MotionTonePreset,
} from "./motion-presets.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Phase layout in time units. Values are duration strings ("0.6s", "600ms")
 * or percentages ("15%") of the scene duration. Must sum to <= 100% / scene.
 */
export type PhaseConfig = Record<string, string>;

/** Semantic easing aliases mapped to craft defaults. */
export type SemanticEasing = "enter" | "exit" | "move" | "loop";

/**
 * Easing for motion and tween calls. Accepts:
 * - Named easing: `"easeOutCubic"`, `"easeInBack"`, etc.
 * - Semantic: `"enter"` | `"exit"` | `"move"` | `"loop"`
 * - Spring name: `"gentle"` | `"playful"` | …
 * - Custom function: `(t: number) => number`
 * - Spring config: `{ stiffness: 180, damping: 18 }`
 */
export type MotionEasing =
  | EasingName
  | SemanticEasing
  | SpringName
  | EasingFn
  | SpringConfig;

/** Optional second arg to createDirector / ctx.director. */
export interface DirectorOpts {
  /** Motion tone — sets default enter pose + easings for motion(). */
  tone?: MotionTone;
}

/** Default max enter duration when `for` is omitted (standard element enter). */
const DEFAULT_ENTER_CAP_SECONDS = 0.375;
/** Auto exit window as fraction of exit phase (exits ~25% faster). */
const DEFAULT_EXIT_PHASE_SCALE = 0.75;

export interface MotionOpts<P extends string = string> {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  blur?: number;
  fromOpacity?: number;

  during?: P;
  at?: string;  // e.g. "0.28s" or "20%"
  /**
   * Enter window length ("0.5s" or "30%"). When omitted, omakase caps wall-clock
   * enter at ~375ms (or the full phase if shorter).
   */
  for?: string;
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
  at?: string;
  for?: string;
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

export interface InOpts {
  /** Phase-local start offset ("0.5s", "500ms", or "25%") */
  at?: string;
  /** Window length ("1s", "500ms", or "50%"). Default: remainder of phase */
  duration?: string;
}

export interface Director<P extends string = string> {
  readonly progress: number;
  readonly seconds: number;
  readonly active: P | "idle";
  /** Phase-local progress 0–1. */
  in(phase: P, opts?: InOpts): number;
  /** Map phase progress → data timeline seconds (for keyframe charts, force, etc.). */
  at(phase: P, dataSeconds: number): number;
  /** Scene-absolute progress from `from` to `to` (e.g. span("0s", "1s")) */
  span(from: string, to: string): number;
  /** Eased scene-absolute transition progress (alias for interpolate(span(...), [0,1], [0,1], easing)) */
  transition(from: string, to: string, easing?: EasingName | EasingFn): number;
  /** True when scene time is strictly inside a span window */
  inSpan(from: string, to: string): boolean;

  motion(opts?: MotionOpts<P>): MotionResult;
  tween(from: number, to: number, opts?: TweenOpts<P>): number;
  value<T extends number | string>(v: T, opts?: ValueOpts<P>): ValueResult<T>;
  /** Nested timing window with local director() — Remotion-style sequence clips */
  clip(opts: ClipOpts): DirectorClip;
}

export type DirectorOf<P extends PhaseConfig | undefined> =
  P extends PhaseConfig
    ? Director<Extract<keyof P, string>>
    : Director<"enter" | "hold" | "exit">;

/** Minimal surface createDirector() needs from the per-frame render context. */
export interface DirectorContext {
  timeline: Timeline;
  fps?: number;
}

export interface ClipOpts {
  /** Named phase from the parent director layout */
  during?: string;
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
  // Semantic craft aliases
  enter: easing.easeOutCubic,
  exit: easing.easeInCubic,
  move: easing.easeInOutCubic,
  loop: easing.linear,
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
  enter: easing.easeInCubic,
  exit: easing.easeInCubic,
  move: easing.easeInOutCubic,
  loop: easing.linear,
};

function resolveEasing(spec: MotionEasing | undefined, fallback: EasingFn): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "function") return spec;
  if (typeof spec === "object") return (t: number) => springCurve(t, resolveSpring(spec));
  if (typeof spec === "string" && isSpringName(spec)) {
    const cfg = resolveSpring(spec);
    return (t: number) => springCurve(t, cfg);
  }
  const fn = NAMED_EASINGS[spec as string];
  if (!fn) {
    throw new Error(
      `Unknown easing: "${spec}". Use a named curve, spring name (${Object.keys({ gentle: 1, snappy: 1, fluid: 1, playful: 1, wobbly: 1 }).join(", ")}), or semantic enter|exit|move|loop`,
    );
  }
  return fn;
}

function mirrorExitEasing(spec: MotionEasing | undefined, fallback: EasingFn): EasingFn {
  if (spec === undefined) return fallback;
  if (typeof spec === "string") {
    if (isSpringName(spec)) {
      // Springs on exit: use easeInCubic (no reverse overshoot)
      return DEFAULT_EXIT_EASING;
    }
    const mirrored = EXIT_MIRROR[spec];
    if (mirrored) return mirrored;
  }
  return resolveEasing(spec, fallback);
}

// -----------------------------------------------------------------------------
// Phase normalization
// -----------------------------------------------------------------------------

/** Normalized phase layout after percent/seconds resolve to scene fractions 0–1. */
export interface NormalizedPhase {
  name: string;
  start: number;
  end: number;
  fraction: number;
}

/**
 * Pure layout of director phases against a total duration.
 * Used by createDirector and by inspect/probe tooling (no timeline required).
 */
export function layoutPhases(cfg: PhaseConfig, totalSeconds: number): NormalizedPhase[] {
  return normalizePhases(cfg, totalSeconds);
}

function parsePhaseDuration(value: string, totalSeconds: number): number {
  const s = value.trim();
  if (s.endsWith("%")) {
    const pct = parseFloat(s);
    if (!Number.isFinite(pct) || pct <= 0)
      throw new Error(`director(): invalid phase "%": "${value}"`);
    return pct / 100;
  }
  if (s.endsWith("ms")) {
    const ms = parseFloat(s);
    if (!Number.isFinite(ms) || ms <= 0)
      throw new Error(`director(): invalid phase duration: "${value}"`);
    return ms / 1000 / totalSeconds;
  }
  if (s.endsWith("s")) {
    const sec = parseFloat(s);
    if (!Number.isFinite(sec) || sec <= 0)
      throw new Error(`director(): invalid phase duration: "${value}"`);
    return sec / totalSeconds;
  }
  throw new Error(`director(): phase "${value}" must end with "s", "ms", or "%" (e.g. "0.6s", "15%")`);
}

function normalizePhases(cfg: PhaseConfig, totalSeconds: number): NormalizedPhase[] {
  const entries = Object.entries(cfg);
  if (entries.length === 0) throw new Error("director(): phase layout must have at least one phase");
  const fractions = entries.map(([name, v]) => ({ name, fraction: parsePhaseDuration(v, totalSeconds) }));
  const total = fractions.reduce((s, f) => s + f.fraction, 0);
  if (total > 1.0000001)
    throw new Error(`director(): phases sum to ${(total * 100).toFixed(1)}% which exceeds 100%`);
  let acc = 0;
  return fractions.map(({ name, fraction }) => {
    const start = acc;
    const end = acc + fraction;
    acc = end;
    return { name, start, end, fraction };
  });
}

/** Convert an at/for value to a scene-fraction offset within the phase. */
function parseMotionTime(value: string, phaseSpan: number, totalSeconds: number): number {
  if (typeof value !== "string") {
    throw new Error(
      `director(): time values must be strings with units ("0.5s", "500ms", or "25%") — got ${typeof value}`,
    );
  }
  const s = value.trim();
  if (s.endsWith("%")) return (parseFloat(s) / 100) * phaseSpan;
  if (s.endsWith("ms")) return parseFloat(s) / 1000 / totalSeconds;
  if (s.endsWith("s")) return parseFloat(s) / totalSeconds;
  throw new Error(`director(): time "${value}" must end with "s", "ms", or "%"`);
}

interface ClipWindow {
  start: number;
  end: number;
}

function resolveClipWindow(
  opts: ClipOpts,
  parentWindow: ClipWindow,
  parentDurationSeconds: number,
  phaseMap?: Map<string, NormalizedPhase>,
): ClipWindow {
  if (opts.during) {
    if (!phaseMap) {
      throw new Error('director.clip({ during }) requires a director with named phases');
    }
    const p = phaseMap.get(opts.during);
    if (!p) {
      throw new Error(
        `director.clip: unknown phase "${opts.during}". Known: ${[...phaseMap.keys()].join(", ")}`,
      );
    }
    return { start: p.start, end: p.end };
  }

  if (opts.duration === undefined) {
    throw new Error("director.clip() requires `duration` or `during`");
  }

  const parentSpan = parentWindow.end - parentWindow.start;
  const fromOffset =
    opts.from === undefined
      ? 0
      : parseMotionTime(opts.from, parentSpan, parentDurationSeconds);

  const durationSpan = parseMotionTime(opts.duration!, parentSpan, parentDurationSeconds);

  const start = parentWindow.start + fromOffset;
  return { start, end: start + durationSpan };
}

function createDirectorClip(
  sceneCtx: DirectorContext,
  window: ClipWindow,
  phaseMap?: Map<string, NormalizedPhase>,
): DirectorClip {
  const { timeline } = sceneCtx;
  const fps = sceneCtx.fps ?? 30;

  const clipFn = (opts: ClipOpts): DirectorClip => {
    const child = resolveClipWindow(opts, window, timeline.durationSeconds, phaseMap);
    return createDirectorClip(sceneCtx, child, phaseMap);
  };

  const clipProgress = () => {
    const s = window.end - window.start;
    return s <= 0 ? 0 : clamp01((timeline.progress - window.start) / s);
  };

  return {
    get active() {
      return timeline.progress >= window.start && timeline.progress < window.end;
    },
    get progress() {
      return clipProgress();
    },
    get frame() {
      const p = clipProgress();
      const s = window.end - window.start;
      const sec = p * s * timeline.durationSeconds;
      const tf = Math.max(1, Math.ceil(s * timeline.durationSeconds * fps));
      return Math.min(tf - 1, Math.floor(sec * fps));
    },
    get seconds() {
      const p = clipProgress();
      const s = window.end - window.start;
      return p * s * timeline.durationSeconds;
    },
    get durationSeconds() {
      return (window.end - window.start) * timeline.durationSeconds;
    },
    get totalFrames() {
      return Math.max(1, Math.ceil((window.end - window.start) * timeline.durationSeconds * fps));
    },
    director<P extends PhaseConfig | undefined = undefined>(phases?: P) {
      const p = clipProgress();
      const s = window.end - window.start;
      const childTimeline: Timeline = {
        frame: timeline.frame,
        fps,
        progress: p,
        seconds: p * s * timeline.durationSeconds,
        durationSeconds: s * timeline.durationSeconds,
        totalFrames: Math.max(1, Math.ceil(s * timeline.durationSeconds * fps)),
      };
      return createDirector({ timeline: childTimeline, fps }, phases);
    },
    clip: clipFn,
  };
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

export function createDirector<P extends PhaseConfig | undefined = undefined>(
  ctx: DirectorContext,
  phases?: P,
  opts?: DirectorOpts,
): DirectorOf<P> {
  const cfg = (phases ?? DEFAULT_PHASES) as PhaseConfig;
  const totalSeconds = ctx.timeline.durationSeconds > 0 ? ctx.timeline.durationSeconds : 1;
  const ordered = normalizePhases(cfg, totalSeconds);
  const phaseMap = new Map<string, NormalizedPhase>(ordered.map((p) => [p.name, p]));
  const sp = ctx.timeline.progress;
  const secs = ctx.timeline.seconds;
  const tonePreset: MotionTonePreset | null = opts?.tone
    ? getMotionTone(opts.tone)
    : null;

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
      `director: unknown phase "${name}". Known: ${ordered.map((o) => o.name).join(", ")}`
    );
    return p;
  }

  function phaseLocal(name: string): number {
    const p = phaseOf(name);
    if (p.start === p.end) return sp >= p.start ? 1 : 0;
    return clamp01((sp - p.start) / (p.end - p.start));
  }

  function phaseIn(name: string, opts?: InOpts): number {
    const local = phaseLocal(name);
    if (!opts) return local;

    const phase = phaseOf(name);
    const span = phase.end - phase.start;
    const atLocal = opts.at !== undefined
      ? parseMotionTime(opts.at, span, totalSeconds) / span
      : 0;
    const durLocal = opts.duration !== undefined
      ? parseMotionTime(opts.duration, span, totalSeconds) / span
      : 1 - atLocal;

    if (local <= atLocal) return 0;
    if (local >= atLocal + durLocal) return 1;
    return clamp01((local - atLocal) / durLocal);
  }

  function phaseAt(name: string, dataSeconds: number): number {
    const local = phaseLocal(name);
    return interpolate(local, [0, 1], [0, dataSeconds]);
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

  function motion(motionOpts: MotionOpts = {}): MotionResult {
    const toneEnter = tonePreset?.enter;
    const startX = motionOpts.x ?? 0;
    const startY = motionOpts.y ?? toneEnter?.y ?? 24;
    const startScale = motionOpts.scale ?? toneEnter?.scale ?? 1;
    const startRotate = motionOpts.rotate ?? 0;
    const startBlur = motionOpts.blur ?? toneEnter?.blur ?? 0;
    const fromOpacity = motionOpts.fromOpacity ?? toneEnter?.fromOpacity ?? 0;
    const during = motionOpts.during;
    const at = motionOpts.at ?? "0s";
    const window = motionOpts.window;
    const easingSpec = motionOpts.easing ?? tonePreset?.enterEasing;
    const exitEasingSpec = motionOpts.exitEasing ?? tonePreset?.exitEasing;
    const exit = motionOpts.exit ?? true;

    // Enter window — omit `for` → omakase wall-clock cap (~375ms)
    let enterStart: number, enterEnd: number;
    if (window) {
      [enterStart, enterEnd] = window;
    } else {
      const phase = during ? phaseOf(during) : firstPhase;
      const phaseSpan = phase.end - phase.start;
      const atFrac = parseMotionTime(at, phaseSpan, totalSeconds);
      let forFrac: number;
      if (motionOpts.for !== undefined) {
        forFrac = parseMotionTime(motionOpts.for, phaseSpan, totalSeconds);
      } else {
        const capFrac = DEFAULT_ENTER_CAP_SECONDS / totalSeconds;
        forFrac = Math.min(phaseSpan - atFrac, capFrac, phaseSpan);
        if (forFrac <= 0) forFrac = Math.max(0, phaseSpan - atFrac);
      }
      enterStart = phase.start + atFrac;
      enterEnd = enterStart + forFrac;
    }
    const enterSpan = enterEnd - enterStart;
    const enterRaw = enterSpan <= 0 ? (sp >= enterStart ? 1 : 0)
      : clamp01((sp - enterStart) / enterSpan);
    const enterDefault = tonePreset
      ? resolveEasing(tonePreset.enterEasing, DEFAULT_ENTER_EASING)
      : DEFAULT_ENTER_EASING;
    const enterEasingFn = resolveEasing(easingSpec, enterDefault);
    const enter = enterEasingFn(enterRaw);

    // Exit window + pose — auto exit uses 75% of last phase (faster resolve)
    const exitOff = exit === false;
    const exitOpts: Partial<MotionOpts> = typeof exit === "object" ? exit : {};
    let exitStart: number, exitEnd: number, exitActive: boolean;
    if (exitOff) {
      exitActive = false; exitStart = 0; exitEnd = 0;
    } else if (exitOpts.window) {
      [exitStart, exitEnd] = exitOpts.window; exitActive = true;
    } else if (exitOpts.for !== undefined || exitOpts.at !== undefined) {
      const phase = lastPhase;
      const phaseSpan = phase.end - phase.start;
      const atFrac = exitOpts.at !== undefined
        ? parseMotionTime(exitOpts.at, phaseSpan, totalSeconds)
        : 0;
      const forFrac = exitOpts.for !== undefined
        ? parseMotionTime(exitOpts.for, phaseSpan, totalSeconds)
        : phaseSpan * DEFAULT_EXIT_PHASE_SCALE;
      exitStart = phase.start + atFrac;
      exitEnd = exitStart + forFrac;
      exitActive = ordered.length >= 2 && lastPhase.name !== firstPhase.name;
    } else if (ordered.length >= 2 && lastPhase.name !== firstPhase.name) {
      const phaseSpan = lastPhase.end - lastPhase.start;
      const exitScale = tonePreset
        ? Math.min(1, 1 / tonePreset.exitSpeed)
        : DEFAULT_EXIT_PHASE_SCALE;
      exitStart = lastPhase.start;
      exitEnd = lastPhase.start + phaseSpan * exitScale;
      exitActive = true;
    } else {
      exitActive = false; exitStart = 0; exitEnd = 0;
    }
    const exitSpan = exitEnd - exitStart;
    const exitRaw = !exitActive || exitSpan <= 0 ? 0
      : clamp01((sp - exitStart) / exitSpan);
    const exitDefault = tonePreset
      ? resolveEasing(tonePreset.exitEasing, DEFAULT_EXIT_EASING)
      : DEFAULT_EXIT_EASING;
    const exitEasingFn = mirrorExitEasing(exitEasingSpec ?? easingSpec, exitDefault);
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
    const { during, at = "0s", for: forOpt = "100%", easing: easingSpec, pattern } = opts;
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

  const parentWindow: ClipWindow = { start: 0, end: 1 };

  const result: Director = {
    progress: sp,
    seconds: secs,
    active: activeName,
    in: phaseIn,
    at: phaseAt,
    span,
    transition,
    inSpan,
    motion,
    tween,
    value,
    clip: (opts: ClipOpts) => createDirectorClip(ctx, resolveClipWindow(opts, parentWindow, totalSeconds, phaseMap), phaseMap),
  };
  return result as unknown as DirectorOf<P>;
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
