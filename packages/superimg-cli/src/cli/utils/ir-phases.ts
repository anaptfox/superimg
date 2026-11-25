//! Derive check/inspect phase shapes from MediaIR scenes.

import type { MediaIRScene, MediaIR } from "@superimg/types";
import { selectBoundaryFrames } from "@superimg/core/ir";

/** Shared shape for check and inspect phase reporting. */
export interface IrDerivedPhase {
  name: string;
  start: number;
  end: number;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
}

/**
 * Map IR progress phases [0,1] onto the command phase shape.
 * (seconds + inclusive frame indices for UI).
 */
export function phasesFromIrScene(
  scene: MediaIRScene,
  totalFrames: number,
  fps: number,
): IrDerivedPhase[] {
  const sceneStart = scene.range.startFrame;
  const sceneFrames = scene.range.endFrame - sceneStart;
  const progressDenominator = Math.max(1, totalFrames - 1);
  return scene.phases.map((p) => {
    const startFrame = sceneStart + Math.floor(p.start * sceneFrames);
    const endExclusive = sceneStart + Math.ceil(p.end * sceneFrames);
    return {
      name: p.name,
      start: startFrame / progressDenominator,
      end: Math.min(1, endExclusive / progressDenominator),
      startSec: startFrame / fps,
      endSec: endExclusive / fps,
      startFrame,
      endFrame: Math.max(startFrame, endExclusive - 1),
    };
  });
}

export interface IrPhasesReport {
  /** Primary scene phases (first scene). */
  phases: IrDerivedPhase[] | null;
  /** All scenes (composed templates gain non-null entries here). */
  scenePhases: Record<string, IrDerivedPhase[]>;
  /** Phases across every scene, in program order. */
  allPhases: IrDerivedPhase[];
}

/**
 * Derive phases for tooling reports from Media IR.
 * Single-scene templates: `phases` is the default scene layout.
 * Composed: `phases` is the first scene; `scenePhases` has all.
 */
export function derivePhasesFromIR(ir: MediaIR): IrPhasesReport {
  const { totalFrames, fps } = ir.clock;
  const scenePhases: Record<string, IrDerivedPhase[]> = {};
  for (const sc of ir.scenes) {
    scenePhases[sc.id] = phasesFromIrScene(sc, totalFrames, fps);
  }
  const first = ir.scenes[0];
  const phases = first ? scenePhases[first.id]! : null;
  const allPhases = ir.scenes.flatMap((scene) => scenePhases[scene.id] ?? []);
  return { phases, scenePhases, allPhases };
}

/**
 * Default check/inspect samples: every phase midpoint and every boundary ±1 frame.
 */
export function phaseHoldBoundarySamples(
  phases: IrDerivedPhase[] | null | undefined,
  fps: number,
  durationSeconds: number,
  resolvedTotalFrames?: number,
): { kind: "progress"; progress: number; label: string }[] {
  if (!phases || phases.length === 0 || durationSeconds <= 0) return [];
  const totalFrames = resolvedTotalFrames ?? Math.max(1, Math.ceil(durationSeconds * fps));
  const frameStep = totalFrames <= 1 ? 0 : 1 / (totalFrames - 1);
  const progresses = new Set<number>();
  const add = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    progresses.add(Number(clamped.toFixed(6)));
  };
  add(0);
  add(1);
  for (const ph of phases) {
    add((ph.start + ph.end) / 2);
    add(ph.start);
    add(ph.end);
    if (frameStep > 0) {
      add(ph.start + frameStep);
      add(ph.start - frameStep);
      add(ph.end - frameStep);
      add(ph.end + frameStep);
    }
  }
  return [...progresses]
    .sort((a, b) => a - b)
    .map((progress) => ({
      kind: "progress" as const,
      progress,
      label: String(progress),
    }));
}

/** Frame-exact samples at every declared scene handoff, including still leaves. */
export function sceneBoundarySamples(ir: MediaIR): { kind: "frame"; frame: number; label: string }[] {
  if (ir.scenes.length <= 1) return [];
  const frames = new Set(selectBoundaryFrames(ir.scenes.map((scene) => scene.range), ir.clock.totalFrames));
  const last = ir.clock.totalFrames - 1;
  for (const scene of ir.scenes) {
    const { startFrame, endFrame } = scene.range;
    for (const frame of [
      startFrame + 1,
      Math.floor((startFrame + endFrame - 1) / 2),
    ]) {
      if (frame >= 0 && frame <= last) frames.add(frame);
    }
  }
  return [...frames].sort((a, b) => a - b).map((frame) => ({
    kind: "frame" as const,
    frame,
    label: `f:${frame}`,
  }));
}

/** Progress [0,1] → active phase name from IR-derived phases. */
export function activePhaseName(
  phases: IrDerivedPhase[] | null | undefined,
  progress: number,
): { name: string; phaseLocal: number } | null {
  if (!phases || phases.length === 0) return null;
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 1) {
    const last = phases[phases.length - 1]!;
    return { name: last.name, phaseLocal: 1 };
  }
  for (const ph of phases) {
    if (p >= ph.start && p < ph.end) {
      const span = ph.end - ph.start;
      const phaseLocal = span <= 0 ? 1 : (p - ph.start) / span;
      return { name: ph.name, phaseLocal };
    }
  }
  return { name: "idle", phaseLocal: 0 };
}
