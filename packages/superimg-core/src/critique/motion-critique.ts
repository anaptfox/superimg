/**
 * Motion craft critique — phase heuristics + static source scans.
 * Pure enough for agents: JSON issues without watching MP4s.
 */

import type { AnyTemplateModule, ComposedTemplate } from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import { readTimeSeconds, wordCount } from "@superimg/stdlib/timing";
import {
  probeDirectorPhases,
  type NormalizedPhase,
} from "../rendering/probe-phases.js";
import { parseDuration } from "../shared/utils.js";

export type CritiqueCode =
  | "HOLD_TOO_SHORT"
  | "EXIT_SLOWER_THAN_ENTER"
  | "TEXT_HOLD_SHORT"
  | "STAGGER_OVER_CAP"
  | "LINEAR_POSITIONAL"
  | "LONG_CONTINUOUS_MOVE"
  | "NO_HOLD_PHASE";

export interface CritiqueIssue {
  severity: "info" | "warning" | "error";
  code: CritiqueCode;
  message: string;
  suggestion: string;
  progress?: number;
  phase?: string;
}

export interface CritiqueMetrics {
  duration: number;
  holdSeconds: number | null;
  enterSeconds: number | null;
  exitSeconds: number | null;
  sampleCount: number;
}

export interface CritiqueReport {
  issues: CritiqueIssue[];
  phases: NormalizedPhase[] | null;
  metrics: CritiqueMetrics;
}

export interface CritiqueOptions {
  data?: Record<string, unknown>;
  /** Sample progresses for text scrape (default multi-point). */
  samples?: number[];
  /** Source code for static craft scans. */
  source?: string;
  /** Minimum hold seconds when duration ≥ minDurationForHold. Default 1. */
  minHoldSeconds?: number;
  minDurationForHold?: number;
}

function guessHoldPhase(phases: NormalizedPhase[]): NormalizedPhase | null {
  if (phases.length === 0) return null;
  const byName = phases.find((p) =>
    /hold|main|body|develop|settle|read|steady/i.test(p.name),
  );
  if (byName) return byName;
  if (phases.length >= 3) {
    // Middle-longest among non-first/last often is hold
    const mid = phases.slice(1, -1);
    return mid.reduce((a, b) => (b.fraction > a.fraction ? b : a), mid[0]!);
  }
  if (phases.length === 2) return phases[0]!;
  return phases[0]!;
}

function guessEnterPhase(phases: NormalizedPhase[]): NormalizedPhase | null {
  if (phases.length === 0) return null;
  return (
    phases.find((p) => /enter|intro|hook|in/i.test(p.name)) ?? phases[0]!
  );
}

function guessExitPhase(phases: NormalizedPhase[]): NormalizedPhase | null {
  if (phases.length < 2) return null;
  return (
    phases.find((p) => /exit|outro|out|resolve/i.test(p.name)) ??
    phases[phases.length - 1]!
  );
}

/** Static source scan for craft anti-patterns. */
export function critiqueSource(source: string): CritiqueIssue[] {
  const issues: CritiqueIssue[] = [];

  // linear easing near motion / transform-like keys
  const linearMotion =
    /(?:motion|tween)\s*\([^)]*easing:\s*['"]linear['"]/g;
  if (linearMotion.test(source)) {
    issues.push({
      severity: "warning",
      code: "LINEAR_POSITIONAL",
      message: "linear easing used on motion/tween",
      suggestion:
        'Use easeOutCubic (enter), easeInCubic (exit), or easeInOutCubic for on-screen moves — reserve linear for loops/progress fills',
    });
  }

  // stagger with each that looks like large fraction without ms API
  if (/stagger\s*\([^)]*each:\s*0\.[2-9]/.test(source) && !/stagger\.ms/.test(source)) {
    issues.push({
      severity: "info",
      code: "STAGGER_OVER_CAP",
      message: "Large stagger `each` fraction may exceed 500ms total cascade",
      suggestion:
        'Prefer std.stagger.ms(items, progress, { windowSeconds, eachMs: 50, capMs: 500 })',
    });
  }

  return issues;
}

/**
 * Critique a loaded template module for motion craft issues.
 */
export function critiqueTemplate(
  template: AnyTemplateModule | ComposedTemplate,
  opts: CritiqueOptions = {},
): CritiqueReport {
  const issues: CritiqueIssue[] = [];

  if (isComposedTemplate(template)) {
    return {
      issues: [
        {
          severity: "info",
          code: "NO_HOLD_PHASE",
          message: "Composed multi-scene templates are not phase-probed at root",
          suggestion: "Inspect individual scenes for craft metrics",
        },
      ],
      phases: null,
      metrics: {
        duration: 0,
        holdSeconds: null,
        enterSeconds: null,
        exitSeconds: null,
        sampleCount: 0,
      },
    };
  }

  const mod = template as AnyTemplateModule & {
    config?: {
      fps?: number;
      duration?: number | string;
      width?: number;
      height?: number;
    };
    sample?: Record<string, unknown>;
    render?: (ctx: unknown) => string;
  };

  const config = mod.config ?? {};
  const fps = config.fps ?? 30;
  let duration = 5;
  if (typeof config.duration === "number") duration = config.duration;
  else if (config.duration) {
    try {
      duration = parseDuration(config.duration, "duration", fps);
    } catch {
      duration = 5;
    }
  }

  const phases = probeDirectorPhases(template, {
    fps,
    durationSeconds: duration,
    data: opts.data,
  });

  const minHold = opts.minHoldSeconds ?? 1;
  const minDur = opts.minDurationForHold ?? 3;

  let holdSeconds: number | null = null;
  let enterSeconds: number | null = null;
  let exitSeconds: number | null = null;

  if (phases && phases.length > 0) {
    const enter = guessEnterPhase(phases);
    const hold = guessHoldPhase(phases);
    const exit = guessExitPhase(phases);
    enterSeconds = enter ? enter.fraction * duration : null;
    holdSeconds = hold ? hold.fraction * duration : null;
    exitSeconds = exit ? exit.fraction * duration : null;

    if (duration >= minDur) {
      if (holdSeconds != null && holdSeconds < minHold) {
        issues.push({
          severity: "warning",
          code: "HOLD_TOO_SHORT",
          message: `Hold phase is ${holdSeconds.toFixed(2)}s (want ≥ ${minHold}s when duration ≥ ${minDur}s)`,
          suggestion:
            "Lengthen hold or use std.phases.recipe(\"hold-heavy\") / std.timing.sceneDuration({ text })",
          phase: hold?.name,
        });
      }
      if (phases.length < 2) {
        issues.push({
          severity: "info",
          code: "NO_HOLD_PHASE",
          message: "Single-phase layout — no separate hold/exit",
          suggestion:
            'Prefer establish → develop → resolve: ctx.director({ enter, hold, exit }) or std.phases.recipe("card")',
        });
      }
    }

    if (
      enterSeconds != null &&
      exitSeconds != null &&
      exitSeconds > enterSeconds * 1.05
    ) {
      issues.push({
        severity: "warning",
        code: "EXIT_SLOWER_THAN_ENTER",
        message: `Exit phase (${exitSeconds.toFixed(2)}s) is longer than enter (${enterSeconds.toFixed(2)}s)`,
        suggestion:
          "Make exit ~25% shorter than enter (e.g. enter 0.5s, exit 0.4s) or use std.phases.fromText",
        phase: exit?.name,
      });
    }

    if (enterSeconds != null && enterSeconds > 1.0) {
      issues.push({
        severity: "info",
        code: "LONG_CONTINUOUS_MOVE",
        message: `Enter phase is ${enterSeconds.toFixed(2)}s wall-clock (individual motions default-cap at ~375ms)`,
        suggestion:
          "Keep functional element enters under ~400ms; use hold for reading time",
        phase: enter?.name,
      });
    }

    // Text hold vs sample text from sample data
    const sample = { ...(mod.sample ?? {}), ...(opts.data ?? {}) };
    const textCandidates = Object.values(sample)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 3);
    if (holdSeconds != null && textCandidates.length > 0) {
      const longest = textCandidates.reduce((a, b) =>
        wordCount(b) > wordCount(a) ? b : a,
      );
      const need = readTimeSeconds(longest);
      if (holdSeconds < need) {
        issues.push({
          severity: "warning",
          code: "TEXT_HOLD_SHORT",
          message: `Hold ${holdSeconds.toFixed(2)}s may be short for "${longest.slice(0, 40)}${longest.length > 40 ? "…" : ""}" (need ≥ ${need.toFixed(2)}s settled)`,
          suggestion:
            "std.timing.readTime(text) for hold length; max(0.8, words/3) seconds",
          phase: hold?.name,
        });
      }
    }
  }

  if (opts.source) {
    issues.push(...critiqueSource(opts.source));
  }

  return {
    issues,
    phases,
    metrics: {
      duration,
      holdSeconds,
      enterSeconds,
      exitSeconds,
      sampleCount: opts.samples?.length ?? 0,
    },
  };
}
