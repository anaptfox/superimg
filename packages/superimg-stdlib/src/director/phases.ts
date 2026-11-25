//! Phase layout normalize + motion time parsing for director().

import type {
  FlatPhaseConfig,
  NormalizedPhase,
  PhaseConfig,
  PhaseTimeWindow,
  PhaseValue,
  StructuredPhaseConfig,
} from "./types.js";

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
  throw new Error(
    `director(): phase "${value}" must end with "s", "ms", or "%" (e.g. "0.6s", "15%")`,
  );
}

function isWindow(value: unknown): value is PhaseTimeWindow {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "number"
    && typeof value[1] === "number"
    && Number.isFinite(value[0])
    && Number.isFinite(value[1]);
}

function isPhaseValue(value: unknown): value is PhaseValue {
  return typeof value === "string" || typeof value === "number" || isWindow(value);
}

function isPhaseMap(value: unknown): value is FlatPhaseConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isPhaseValue);
}

/** True when the layout is `{ acts, cues }` rather than a flat phase map. */
export function isStructuredPhaseConfig(cfg: PhaseConfig): cfg is StructuredPhaseConfig {
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) return false;
  const keys = Object.keys(cfg);
  if (keys.length === 0 || keys.some((key) => key !== "acts" && key !== "cues")) return false;
  const structured = cfg as StructuredPhaseConfig;
  if (structured.acts === undefined && structured.cues === undefined) return false;
  if (structured.acts !== undefined && !isPhaseMap(structured.acts)) return false;
  if (structured.cues !== undefined && !isPhaseMap(structured.cues)) return false;
  return true;
}

function materialized(
  name: string,
  start: number,
  end: number,
  totalSeconds: number,
  kind?: "act" | "cue",
): NormalizedPhase {
  const fraction = Math.max(0, end - start);
  return {
    name,
    start,
    end,
    fraction,
    duration: fraction,
    startSec: start * totalSeconds,
    endSec: end * totalSeconds,
    ...(kind !== undefined ? { kind } : {}),
  };
}

function normalizeFlat(
  map: FlatPhaseConfig,
  totalSeconds: number,
  kind?: "act" | "cue",
): NormalizedPhase[] {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    throw new Error("director(): phase layout must have at least one phase");
  }
  const safeSeconds = totalSeconds > 0 ? totalSeconds : 1;
  const sequential: { name: string; fraction: number }[] = [];
  const order: Array<{ kind: "seq"; name: string } | { kind: "win"; phase: NormalizedPhase }> = [];

  for (const [name, value] of entries) {
    if (isWindow(value)) {
      if (value[0] < 0 || !(value[1] > value[0])) {
        throw new Error(`director(): phase "${name}" window [${value[0]}, ${value[1]}] must be start < end and start ≥ 0`);
      }
      if (value[0] >= safeSeconds) {
        throw new Error(`director(): phase "${name}" starts at ${value[0]}s, past the ${safeSeconds}s scene`);
      }
      const start = value[0] / safeSeconds;
      const end = Math.min(1, value[1] / safeSeconds);
      order.push({ kind: "win", phase: materialized(name, start, end, safeSeconds, kind) });
      continue;
    }
    const fraction = typeof value === "number"
      ? (() => {
          if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`director(): invalid phase duration: "${value}"`);
          }
          return value / safeSeconds;
        })()
      : parsePhaseDuration(value, safeSeconds);
    sequential.push({ name, fraction });
    order.push({ kind: "seq", name });
  }

  const total = sequential.reduce((sum, entry) => sum + entry.fraction, 0);
  const roundoff = Number.EPSILON * Math.max(1, sequential.length) * 4;
  if (total > 1 + roundoff) {
    throw new Error(
      `director(): phases sum to ${(total * 100).toFixed(1)}% which exceeds 100%`,
    );
  }

  const placed = new Map<string, NormalizedPhase>();
  let acc = 0;
  for (const entry of sequential) {
    const start = acc;
    const end = Math.min(1, acc + entry.fraction);
    acc = end;
    placed.set(entry.name, materialized(entry.name, start, end, safeSeconds, kind));
  }

  return order.map((item) => item.kind === "win" ? item.phase : placed.get(item.name)!);
}

export function normalizePhases(
  cfg: PhaseConfig,
  totalSeconds: number,
): NormalizedPhase[] {
  if (isStructuredPhaseConfig(cfg)) {
    const acts = cfg.acts ? normalizeFlat(cfg.acts, totalSeconds, "act") : [];
    const cues = cfg.cues ? normalizeFlat(cfg.cues, totalSeconds, "cue") : [];
    if (acts.length + cues.length === 0) {
      throw new Error("director(): phase layout must have at least one phase");
    }
    const names = new Set<string>();
    for (const phase of [...acts, ...cues]) {
      if (names.has(phase.name)) {
        throw new Error(`director(): duplicate phase "${phase.name}"`);
      }
      names.add(phase.name);
    }
    return [...acts, ...cues];
  }
  return normalizeFlat(cfg as FlatPhaseConfig, totalSeconds);
}

/** Convert an at/for value to a scene-fraction offset within the phase. */
export function parseMotionTime(
  value: string,
  phaseSpan: number,
  totalSeconds: number,
): number {
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
