//! createDirector factory — phases, motion, tween, value, clip.

import type { EasingFn, EasingName } from "../easing.js";
import { clamp01 } from "../easing.js";
import * as easing from "../easing.js";
import { lerp } from "../math-basic.js";
import { getMotionTone, type MotionTonePreset } from "../motion-presets.js";
import {
  DEFAULT_ENTER_EASING,
  DEFAULT_EXIT_EASING,
  easingDescriptor,
  mirrorExitEasing,
  mirroredExitEasingDescriptor,
  resolveEasing,
} from "./easing.js";
import { isStructuredPhaseConfig, normalizePhases, parseMotionTime } from "./phases.js";
import { makeResult } from "./style.js";
import { createDirectorClip, resolveClipWindow, type ClipWindow } from "./clip.js";
import type {
  BeatState,
  BeatsOpts,
  Director,
  DirectorContext,
  DirectorOf,
  DirectorOpts,
  DirectorPhases,
  FlatPhaseConfig,
  InOpts,
  MotionEasing,
  MotionOpts,
  MotionResult,
  NormalizedPhase,
  PhaseConfig,
  PhaseSpanTarget,
  PhaseTimeWindow,
  SpanOpts,
  TweenOpts,
  ValueOpts,
  ValueResult,
  ValueTweenOpts,
  ClipOpts,
} from "./types.js";

/** Default max enter duration when `for` is omitted (standard element enter). */
const DEFAULT_ENTER_CAP_SECONDS = 0.375;
/** Auto exit window as fraction of exit phase (exits ~25% faster). */
const DEFAULT_EXIT_PHASE_SCALE = 0.75;

const DEFAULT_PHASES: PhaseConfig = { enter: "15%", hold: "70%", exit: "15%" };

export function createDirector<P extends PhaseConfig | undefined = undefined>(
  ctx: DirectorContext,
  phases?: P,
  opts?: DirectorOpts,
): DirectorOf<P> {
  const cfg = resolvePhaseConfig(phases, opts);
  const totalSeconds = ctx.timeline.durationSeconds > 0 ? ctx.timeline.durationSeconds : 1;
  const ordered = normalizePhases(cfg, totalSeconds);
  const phaseMap = new Map<string, NormalizedPhase>(ordered.map((p) => [p.name, p]));
  const sp = ctx.timeline.progress;
  const secs = ctx.timeline.seconds;
  const tonePreset: MotionTonePreset | null = opts?.tone
    ? getMotionTone(opts.tone)
    : null;
  const instrument = ctx.instrument;
  const sceneId = instrument?.sceneId ?? "default";
  const frame = instrument?.frame ?? ctx.timeline.frame;
  const sceneStartFrame = instrument?.sceneStartFrame ?? 0;
  const totalFrames = instrument?.totalFrames ?? ctx.timeline.totalFrames;

  if (instrument?.onDirector) {
    instrument.onDirector({
      sceneId,
      phases: ordered.map((p) => ({ name: p.name, start: p.start, end: p.end })),
      frame,
      sceneStartFrame,
      totalFrames,
    });
  }

  const firstPhase = ordered[0]!;
  const lastPhase = ordered[ordered.length - 1]!;

  const activeName: string = (() => {
    if (sp >= 1) {
      let best = ordered[0]!;
      for (const phase of ordered) if (phase.end >= best.end) best = phase;
      return best.name;
    }
    for (const p of ordered) if (sp >= p.start && sp < p.end) return p.name;
    return "idle";
  })();

  const phasesView = ordered.slice() as unknown as DirectorPhases<string>;
  for (const phase of ordered) {
    (phasesView as unknown as Record<string, NormalizedPhase>)[phase.name] = phase;
  }

  function phaseOf(name: string): NormalizedPhase {
    const p = phaseMap.get(name);
    if (!p)
      throw new Error(
        `director: unknown phase "${name}". Known: ${ordered.map((o) => o.name).join(", ")}`,
      );
    return p;
  }

  function isNumericWindow(value: unknown): value is PhaseTimeWindow {
    return Array.isArray(value)
      && value.length === 2
      && typeof value[0] === "number"
      && typeof value[1] === "number";
  }

  function looksLikeTime(value: string): boolean {
    return /(?:ms|s|%)$/.test(value.trim());
  }

  function windowOf(target: PhaseSpanTarget<string>): { start: number; end: number } {
    if (typeof target === "string") {
      const phase = phaseOf(target);
      return { start: phase.start, end: phase.end };
    }
    if (isNumericWindow(target)) {
      const start = target[0] / totalSeconds;
      const end = target[1] / totalSeconds;
      if (!(end > start)) {
        throw new Error(`director(): window [${target[0]}, ${target[1]}] must have start < end`);
      }
      return { start, end };
    }
    const from = phaseOf(String(target[0]));
    const to = phaseOf(String(target[1]));
    return { start: Math.min(from.start, to.start), end: Math.max(from.end, to.end) };
  }

  function progressOf(target: PhaseSpanTarget<string>, clamp = true): number {
    const window = windowOf(target);
    if (window.end === window.start) return sp >= window.start ? 1 : 0;
    const raw = (sp - window.start) / (window.end - window.start);
    return clamp ? clamp01(raw) : raw;
  }

  function easeProgress(raw: number, ease?: MotionEasing | SpanOpts | InOpts): number {
    if (ease === undefined) return raw;
    if (typeof ease === "string" || typeof ease === "function") {
      return resolveEasing(ease, easing.linear)(raw);
    }
    if ("stiffness" in ease) return resolveEasing(ease, easing.linear)(raw);
    const spec = ease.ease ?? ease.easing;
    return spec === undefined ? raw : resolveEasing(spec, easing.linear)(raw);
  }

  function phaseLocal(target: PhaseSpanTarget<string>): number {
    return progressOf(target);
  }

  function phaseIn(target: PhaseSpanTarget<string>, inOpts?: InOpts | MotionEasing): number {
    const opts: InOpts | undefined =
      inOpts === undefined ? undefined
      : typeof inOpts === "string" || typeof inOpts === "function" || "stiffness" in inOpts
        ? { ease: inOpts }
        : inOpts;
    const clamp = opts?.clamp !== false;
    let local = progressOf(target, clamp);
    if (opts?.at !== undefined || opts?.duration !== undefined) {
      const window = windowOf(target);
      const span = window.end - window.start;
      const atLocal = opts.at !== undefined ? parseMotionTime(opts.at, span, totalSeconds) / span : 0;
      const durLocal = opts.duration !== undefined
        ? parseMotionTime(opts.duration, span, totalSeconds) / span
        : 1 - atLocal;
      if (local <= atLocal) local = 0;
      else if (local >= atLocal + durLocal) local = 1;
      else local = durLocal <= 0 ? 1 : (local - atLocal) / durLocal;
      if (clamp) local = clamp01(local);
    }
    return easeProgress(local, opts);
  }

  function phaseAt(target: PhaseSpanTarget<string>, dataSeconds: number): number {
    return phaseLocal(target) * dataSeconds;
  }

  function legacySpan(from: string, to: string): number {
    const start = parseMotionTime(from, 1, totalSeconds);
    const end = parseMotionTime(to, 1, totalSeconds);
    if (sp <= start) return 0;
    if (sp >= end) return 1;
    return clamp01((sp - start) / (end - start));
  }

  function span(target: PhaseSpanTarget<string> | string, easeOrTo?: MotionEasing | SpanOpts | string, maybeEase?: MotionEasing | SpanOpts): number {
    if (typeof target === "string" && typeof easeOrTo === "string" && (looksLikeTime(target) || looksLikeTime(easeOrTo))) {
      return easeProgress(legacySpan(target, easeOrTo), maybeEase);
    }
    if (typeof target === "string" && typeof easeOrTo === "string" && phaseMap.has(target) && phaseMap.has(easeOrTo)) {
      return easeProgress(progressOf([target, easeOrTo]), maybeEase);
    }
    if (typeof target === "string" && typeof easeOrTo === "string" && !phaseMap.has(target)) {
      return easeProgress(legacySpan(target, easeOrTo), maybeEase);
    }
    return easeProgress(progressOf(target as PhaseSpanTarget<string>), easeOrTo as MotionEasing | SpanOpts | undefined);
  }

  function transition(from: string, to: string, ease?: MotionEasing): number {
    const raw = span(from, to);
    if (!ease) return raw;
    return resolveEasing(ease, easing.linear)(raw);
  }

  function inSpan(from: string | PhaseSpanTarget<string>, to?: string): boolean {
    const raw = to === undefined ? progressOf(from as PhaseSpanTarget<string>) : span(from as string, to);
    return raw > 0 && raw < 1;
  }

  function targetsOf(value: PhaseSpanTarget<string> | readonly (string | PhaseTimeWindow)[]): PhaseSpanTarget<string>[] {
    if (Array.isArray(value)) {
      if (isNumericWindow(value)) return [value];
      return value as PhaseSpanTarget<string>[];
    }
    return [value as PhaseSpanTarget<string>];
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
    const easingSpec = motionOpts.easing ?? motionOpts.ease ?? tonePreset?.enterEasing;
    const exitEasingSpec = motionOpts.exitEasing ?? motionOpts.exitEase ?? tonePreset?.exitEasing;
    const exit = motionOpts.exit;
    const duringPhase = during !== undefined ? windowOf(during) : undefined;
    const hasLaterPhase = duringPhase
      ? ordered.some((p) => p.start >= duringPhase.end - 1e-12)
      : false;
    // Last act holds. Scene-wide (no `during`) holds. Opt in with exit: true / exit: { … }.
    const exitOff = exit === false || (exit === undefined && !hasLaterPhase);

    // Enter window — omit `for` → omakase wall-clock cap (~375ms)
    let enterStart: number, enterEnd: number;
    if (window) {
      [enterStart, enterEnd] = window;
    } else {
      const phase = duringPhase ?? firstPhase;
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
    const enterRaw =
      enterSpan <= 0
        ? sp >= enterStart
          ? 1
          : 0
        : clamp01((sp - enterStart) / enterSpan);
    const enterDefault = tonePreset
      ? resolveEasing(tonePreset.enterEasing, DEFAULT_ENTER_EASING)
      : DEFAULT_ENTER_EASING;
    const enterEasingFn = resolveEasing(easingSpec, enterDefault);
    const enter = enterEasingFn(enterRaw);

    // Exit window + pose — last act holds unless exit: true or exit: { ... }
    const exitOpts: Partial<MotionOpts> = typeof exit === "object" ? exit : {};
    let exitStart: number, exitEnd: number, exitActive: boolean;
    if (exitOff) {
      exitActive = false;
      exitStart = 0;
      exitEnd = 0;
    } else if (exitOpts.window) {
      [exitStart, exitEnd] = exitOpts.window;
      exitActive = true;
    } else if (exitOpts.for !== undefined || exitOpts.at !== undefined) {
      const phase = lastPhase;
      const phaseSpan = phase.end - phase.start;
      const atFrac =
        exitOpts.at !== undefined
          ? parseMotionTime(exitOpts.at, phaseSpan, totalSeconds)
          : 0;
      const forFrac =
        exitOpts.for !== undefined
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
      exitActive = false;
      exitStart = 0;
      exitEnd = 0;
    }
    const exitSpan = exitEnd - exitStart;
    const exitRaw =
      !exitActive || exitSpan <= 0 ? 0 : clamp01((sp - exitStart) / exitSpan);
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
    const describedEnter = easingDescriptor(easingSpec);
    const describedExit = exitActive
      ? mirroredExitEasingDescriptor(exitEasingSpec ?? easingSpec)
      : undefined;

    if (instrument?.onMotion) {
      const localId = motionOpts.id;
      if (!localId) {
        if (instrument.strictIds) {
          throw new Error(
            `director.motion: missing required id (Media IR). Pass id: "my.motion"`,
          );
        }
        instrument.onIssue?.({
          code: "anonymous_id",
          message: "director.motion has no stable id; motion semantics are sampled",
          sceneId,
          frame,
        });
      } else {
        instrument.onMotion({
          localId,
          sceneId,
          kind: "motion",
          ...(motionOpts.target !== undefined ? { target: motionOpts.target } : {}),
          enterStart,
          enterEnd,
          ...(exitActive ? { exitStart, exitEnd } : {}),
          from: {
            x: startX,
            y: startY,
            scale: startScale,
            rotate: startRotate,
            blur: startBlur,
            opacity: fromOpacity,
          },
          to: { x: 0, y: 0, scale: 1, rotate: 0, blur: 0, opacity: 1 },
          ...(exitActive
            ? {
                exitTo: {
                  x: exitToX,
                  y: exitToY,
                  scale: exitToScale,
                  rotate: exitToRotate,
                  blur: exitToBlur,
                  opacity: 0,
                },
              }
            : {}),
          ...(describedEnter !== undefined ? { easing: describedEnter } : {}),
          ...(describedExit !== undefined ? { exitEasing: describedExit } : {}),
          frame,
          sceneStartFrame,
          totalFrames,
        });
      }
    }

    return makeResult(ax, ay, aScale, aRotate, aBlur, opacity, enter, exitEased);
  }

  function tween(fromOrOpts: number | ValueTweenOpts, to?: number, tweenOpts: TweenOpts = {}): number {
    if (typeof fromOrOpts === "object") {
      return tween(fromOrOpts.from ?? 0, fromOrOpts.to ?? 1, fromOrOpts);
    }
    const from = fromOrOpts;
    const end = to ?? 1;
    const {
      during,
      at = "0s",
      for: forOpt = "100%",
      pattern,
    } = tweenOpts;
    const easingSpec = tweenOpts.easing ?? tweenOpts.ease;
    const phase = during !== undefined ? windowOf(during) : firstPhase;
    const spanLen = phase.end - phase.start;
    const atFrac = parseMotionTime(at, spanLen, totalSeconds);
    const forFrac = parseMotionTime(forOpt, spanLen, totalSeconds);
    const localStart = phase.start + atFrac;
    const localEnd = localStart + forFrac;
    const localSpan = localEnd - localStart;
    const raw =
      localSpan <= 0
        ? sp >= localStart
          ? 1
          : 0
        : clamp01((sp - localStart) / localSpan);

    let eased: number;
    if (pattern === "sine") eased = Math.sin(raw * Math.PI);
    else if (pattern === "pulse")
      eased = 0.5 + 0.5 * Math.sin(raw * Math.PI * 6 - Math.PI / 2);
    else if (pattern === "bounce") eased = easing.easeOutBounce(raw);
    else if (pattern === "linear") eased = raw;
    else eased = resolveEasing(easingSpec, DEFAULT_ENTER_EASING)(raw);

    if (instrument?.onMotion) {
      const localId = tweenOpts.id;
      if (!localId) {
        if (instrument.strictIds) {
          throw new Error(
            `director.tween: missing required id (Media IR). Pass id: "my.tween"`,
          );
        }
        instrument.onIssue?.({
          code: "anonymous_id",
          message: "director.tween has no stable id; motion semantics are sampled",
          sceneId,
          frame,
        });
      } else {
        instrument.onMotion({
          localId,
          sceneId,
          kind: "tween",
          ...(tweenOpts.target !== undefined ? { target: tweenOpts.target } : {}),
          ...(tweenOpts.property !== undefined ? { property: tweenOpts.property } : {}),
          enterStart: localStart,
          enterEnd: localEnd,
          from: { value: from },
          to: { value: end },
          ...(pattern && pattern !== "linear"
            ? { easing: { kind: "named" as const, name: `pattern:${pattern}` } }
            : easingDescriptor(easingSpec) !== undefined
              ? { easing: easingDescriptor(easingSpec) }
              : {}),
          ...(pattern !== undefined ? { pattern } : {}),
          frame,
          sceneStartFrame,
          totalFrames,
        });
      }
    }

    return lerp(from, end, eased);
  }

  function beats<N extends string>(opts: BeatsOpts<N>): BeatState<N> {
    const names = opts.of;
    if (names.length === 0) {
      throw new Error("director.beats: `of` must list at least one beat");
    }
    const window = opts.during !== undefined ? windowOf(opts.during) : { start: 0, end: 1 };
    const span = window.end - window.start;
    const local = span <= 0 ? 1 : clamp01((sp - window.start) / span);
    const n = names.length;
    const beatSpan = 1 / n;
    const rawIndex = Math.min(n - 1, Math.floor(local / beatSpan + 1e-9));
    const inBeat = beatSpan <= 0 ? 1 : clamp01((local - rawIndex * beatSpan) / beatSpan);
    const beatSceneSpan = span / n;
    const crossScene =
      opts.cross !== undefined
        ? parseMotionTime(opts.cross, beatSceneSpan, totalSeconds)
        : 0.08 * beatSceneSpan;
    const crossOfBeat = beatSceneSpan > 0 ? Math.max(0, Math.min(0.5, crossScene / beatSceneSpan)) : 0;
    if (rawIndex < n - 1 && crossOfBeat > 0 && inBeat >= 1 - crossOfBeat) {
      const mix = clamp01((inBeat - (1 - crossOfBeat)) / crossOfBeat);
      return {
        crossing: true,
        from: names[rawIndex]!,
        to: names[rawIndex + 1]!,
        mix,
        index: rawIndex,
      };
    }
    return {
      crossing: false,
      name: names[rawIndex]!,
      local: inBeat,
      index: rawIndex,
    };
  }

  function value<T extends number | string>(vOrOpts: T | ValueTweenOpts, valueOpts: ValueOpts = {}): ValueResult<T> | number {
    if (vOrOpts !== null && typeof vOrOpts === "object" && ("from" in vOrOpts || "to" in vOrOpts)) {
      return tween(vOrOpts);
    }
    const v = vOrOpts as T;
    let opacity = 1;
    if (valueOpts.during) {
      const windows = targetsOf(valueOpts.during).map(windowOf);
      if (!windows.some((window) => sp >= window.start && sp < window.end)) opacity = 0;
    }
    if (valueOpts.fadeOn) {
      for (const window of targetsOf(valueOpts.fadeOn).map(windowOf)) {
        if (sp >= window.start) {
          const spanLen = window.end - window.start;
          opacity *= 1 - (spanLen <= 0 ? 1 : clamp01((sp - window.start) / spanLen));
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
    phases: phasesView as Director["phases"],
    in: phaseIn,
    phaseIn,
    phaseLocal,
    at: phaseAt,
    beats,
    span,
    transition,
    inSpan,
    motion,
    tween,
    value: value as Director["value"],
    clip: (clipOpts: ClipOpts) =>
      createDirectorClip(
        ctx,
        resolveClipWindow(clipOpts, parentWindow, totalSeconds, phaseMap),
        phaseMap,
        createDirector,
      ),
  };
  return result as unknown as DirectorOf<P>;
}

function resolvePhaseConfig(phases: PhaseConfig | undefined, opts?: DirectorOpts): PhaseConfig {
  const fromOpts = opts?.acts || opts?.cues
    ? {
        ...(opts.acts ? { acts: opts.acts } : {}),
        ...(opts.cues ? { cues: opts.cues } : {}),
      }
    : undefined;
  if (phases === undefined) return fromOpts ?? DEFAULT_PHASES;
  if (!fromOpts) return phases;
  if (isStructuredPhaseConfig(phases)) {
    return {
      ...(phases.acts || opts?.acts ? { acts: { ...phases.acts, ...opts?.acts } } : {}),
      ...(phases.cues || opts?.cues ? { cues: { ...phases.cues, ...opts?.cues } } : {}),
    };
  }
  return {
    acts: { ...(phases as FlatPhaseConfig), ...opts?.acts },
    ...(opts?.cues ? { cues: opts.cues } : {}),
  };
}
