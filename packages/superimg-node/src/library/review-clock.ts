//! Parse --at sample list for superimg inspect.

import { resolveFrameIndex } from "@superimg/core/runtime";

export type AtSample =
  | { kind: "progress"; progress: number; label: string }
  | { kind: "frame"; frame: number; label: string }
  | { kind: "seconds"; seconds: number; label: string };

export interface AtClock {
  fps: number;
  duration: number;
  totalFrames: number;
}

export interface ResolvedAtSample {
  /** Requested progress for legacy selectors; resolved progress for time/frame selectors. */
  progress: number;
  frame: number;
  /** Encoded frame timestamp, distinct from the endpoint-inclusive media timeline. */
  seconds: number;
  /** Root media timeline.seconds. Child scenes have their own local clocks. */
  timelineSeconds: number;
}

/** Resolve every selector through the same clamped frame clock. */
export function resolveAtSample(sample: AtSample, clock: AtClock): ResolvedAtSample {
  const frame = resolveFrameIndex({
    ...(sample.kind === "progress"
      ? { progress: sample.progress }
      : { frame: sample.kind === "frame" ? sample.frame : Math.round(sample.seconds * clock.fps) }),
    fps: clock.fps,
    durationSeconds: clock.duration,
    totalFrames: clock.totalFrames,
  });
  const frameProgress = clock.totalFrames <= 1 ? 0 : frame / (clock.totalFrames - 1);
  return {
    progress: sample.kind === "progress" ? sample.progress : frameProgress,
    frame,
    seconds: frame / clock.fps,
    timelineSeconds: (clock.totalFrames === 1 ? 1 : frameProgress) * clock.totalFrames / clock.fps,
  };
}

const DEFAULT_AT = ["0", "0.25", "0.5", "0.75", "1"];

/**
 * Parse a comma-separated --at list.
 * Accepts progress 0–1, explicit seconds/milliseconds, and frames f:N or Nf.
 */
export function parseAtList(raw: string | undefined): AtSample[] {
  const parts = (raw?.trim() ? raw.split(",") : DEFAULT_AT)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("--at list is empty");
  }

  return parts.map((part) => {
    const frameToken = /^f:(\d+)$/i.exec(part) ?? /^(\d+)f$/i.exec(part);
    if (frameToken) {
      const frame = Number(frameToken[1]);
      if (!Number.isSafeInteger(frame) || frame < 0) {
        throw new Error(`Invalid --at frame sample: "${part}" (expected f:N with N ≥ 0)`);
      }
      return { kind: "frame" as const, frame, label: /^f:/i.test(part) ? `f:${frame}` : part };
    }

    const timeToken = /^((?:\d+(?:\.\d*)?|\.\d+))(ms|s)$/i.exec(part);
    if (timeToken) {
      const seconds = Number(timeToken[1]) / (timeToken[2]!.toLowerCase() === "ms" ? 1000 : 1);
      if (!Number.isFinite(seconds)) {
        throw new Error(`Invalid --at time sample: "${part}" (expected non-negative seconds or milliseconds)`);
      }
      return { kind: "seconds" as const, seconds, label: part };
    }

    const percent = /^((?:\d+(?:\.\d*)?|\.\d+))%$/.exec(part);
    const progress = percent ? Number(percent[1]) / 100 : Number(part);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      throw new Error(
        `Invalid --at sample: "${part}" (expected progress 0–1, seconds, milliseconds, or frames: 0.5, 1.5s, 1500ms, f:45, 45f)`,
      );
    }
    return { kind: "progress" as const, progress, label: String(progress) };
  });
}

/** Classify only a caller-supplied CLI selector as a usage error. */
export function parseCliAtList(raw: string): AtSample[] {
  try {
    if (!raw.trim()) throw new Error("--at list is empty");
    if (raw.split(",").some(part => !/(?:%|ms|s|f)$|^f:\d+$/i.test(part.trim()))) {
      throw new Error("--at requires explicit units, for example 50%, 0.5s, 500ms, or 15f");
    }
    return parseAtList(raw);
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: "INVALID_TIME" });
  }
}

/** Parse --diff a,b into two progresses 0–1. */
export function parseDiffPair(raw: string): { from: number; to: number } {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`--diff expects two progresses, e.g. --diff 0.35,0.85 (got "${raw}")`);
  }
  const from = Number(parts[0]);
  const to = Number(parts[1]);
  if (![from, to].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
    throw new Error(`--diff values must be 0–1 (got "${raw}")`);
  }
  return { from, to };
}
