//! Probe director phase layout from a template without a full render pipeline.

import type { AnyTemplateModule, ComposedTemplate, TemplateModule } from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import {
  createDirector,
  layoutPhases,
  type NormalizedPhase,
  type PhaseConfig,
} from "@superimg/stdlib/director";
import { createRenderContext } from "./create-render-context.js";
import { parseDuration } from "../shared/utils.js";

export type { NormalizedPhase, PhaseConfig };

export interface ProbePhasesOptions {
  fps?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
}

function isComposed(
  template: AnyTemplateModule | ComposedTemplate,
): template is ComposedTemplate {
  return isComposedTemplate(template);
}

/**
 * Run template.render once with a director wrapper that captures the first
 * phase config passed to ctx.director(...). Returns layoutPhases result, or
 * null if the template never calls director with phases.
 */
export function probeDirectorPhases(
  template: AnyTemplateModule | ComposedTemplate,
  opts: ProbePhasesOptions = {},
): NormalizedPhase[] | null {
  if (isComposed(template)) {
    // Multi-scene compositions don't expose a single director layout at the root.
    return null;
  }

  const mod = template as TemplateModule;
  const config = mod.config;
  const fps = opts.fps ?? config?.fps ?? 30;
  let durationSeconds = opts.durationSeconds;
  if (durationSeconds === undefined) {
    if (typeof config?.duration === "number") {
      durationSeconds = config.duration;
    } else if (config?.duration) {
      durationSeconds = parseDuration(config.duration, "duration", fps);
    } else {
      durationSeconds = 5;
    }
  }
  const width = opts.width ?? config?.width ?? 1920;
  const height = opts.height ?? config?.height ?? 1080;
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));
  const data = { ...(mod.sample ?? {}), ...(opts.data ?? {}) };

  const baseCtx = createRenderContext(
    0,
    fps,
    totalFrames,
    width,
    height,
    data,
  );

  let captured: PhaseConfig | null = null;
  const directorCtx = { timeline: baseCtx.timeline, fps };

  const probeCtx = {
    ...baseCtx,
    director: (phases?: PhaseConfig, opts?: import("@superimg/stdlib/director").DirectorOpts) => {
      if (phases && !captured) {
        captured = phases;
      }
      return createDirector(directorCtx, phases, opts);
    },
  };

  try {
    mod.render(probeCtx as typeof baseCtx);
  } catch {
    // Probe is best-effort — still return layout if director was called before throw.
  }

  if (!captured) return null;
  return layoutPhases(captured, durationSeconds);
}

/** Find the active phase at scene progress 0–1. */
export function activePhaseAt(
  phases: NormalizedPhase[],
  progress: number,
): { phase: NormalizedPhase; phaseLocal: number } | null {
  if (phases.length === 0) return null;
  const p = Math.max(0, Math.min(1, progress));
  const last = phases[phases.length - 1]!;
  if (p >= 1) {
    return { phase: last, phaseLocal: 1 };
  }
  for (const ph of phases) {
    if (p >= ph.start && p < ph.end) {
      const span = ph.end - ph.start;
      const phaseLocal = span <= 0 ? 1 : (p - ph.start) / span;
      return { phase: ph, phaseLocal };
    }
  }
  return { phase: last, phaseLocal: 1 };
}
