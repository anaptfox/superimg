import type { ResolveCueFinding } from "@superimg/types";
import type { CardBlock, ScriptBlock, ShotBlock, SpeechBlock } from "./types.js";

/**
 * Script times are decimals ("1.9"), but the reading rule sums floats, so a
 * boundary that is exact on paper can land one ulp either side of it. Every
 * comparison of two times uses this tolerance (a nanosecond, far below a
 * frame). Stored times stay raw: a frame renders at the same shot-local
 * second as it always did.
 */
export const EPSILON = 1e-9;
/** Published times (cues, duration) are rounded to a microsecond. */
export const quantize = (seconds: number) => Math.round(seconds * 1e6) / 1e6;

type Line = {
  block: SpeechBlock | CardBlock;
  index: number;
  start: number;
  typed: number;
  end: number;
  still: number;
};

export type TimedShot = {
  id: string | null;
  text: string;
  section: string | null;
  fields: Readonly<Record<string, string>>;
  start: number;
  end: number;
  duration: number;
  in: number;
  still: number;
  lines: readonly Line[];
};

export type ClockOptions = {
  /** Measured speech clip durations in seconds, keyed by speech block id. */
  speechDurations?: ReadonlyMap<string, number>;
};

export function clock(blocks: readonly ScriptBlock[], options: ClockOptions = {}) {
  const { speechDurations } = options;
  const sections: { shot: ShotBlock; lines: Line[] }[] = [];
  const findings: ResolveCueFinding[] = [];
  for (const [index, block] of blocks.entries()) {
    if (block.kind === "shot") {
      sections.push({ shot: block, lines: [] });
      continue;
    }
    const current = sections.at(-1);
    if (!current) {
      findings.push({
        id: block.id ?? `block-${index}`,
        code: "BLOCK_BEFORE_SHOT",
        message: `This ${block.kind} comes before the first shot, so no shot owns it.`,
      });
      continue;
    }
    const previous = current.lines.at(-1);
    const gap = previous?.block.kind === "speech" && previous.block.pace === "beat" ? 0.55 : 0.3;
    const start = block.at?.start ?? (previous?.end ?? 0) + gap;
    const text = block.lines.join(" ");
    const typing = Math.min(0.8, text.length * 0.021);
    const measuredDuration =
      block.kind === "speech" && block.id ? speechDurations?.get(block.id) : undefined;
    const validMeasured =
      measuredDuration !== undefined && Number.isFinite(measuredDuration) && measuredDuration > 0
        ? measuredDuration
        : undefined;
    const end =
      block.at?.end ??
      (validMeasured !== undefined
        ? start + validMeasured
        : start + Math.max(1.6, Math.max(0.3, typing) + 0.33 * text.split(" ").length));
    const typed = Math.min(start + typing, end);
    const still = block.kind === "speech"
      ? Math.max(start, Math.min(typed + 0.3, end - 0.05))
      : start + (end - start) * 0.7;
    current.lines.push({ block, index, start, typed, end, still });
  }

  // Accumulate shot boundaries in integer microseconds so decimal holds never drift.
  let totalMicros = 0;
  const shots: TimedShot[] = sections.map(({ shot, lines }) => {
    // The shot lasts until its latest line has finished, whatever the script order.
    const latest = lines.reduce((end, line) => Math.max(end, line.end), -Infinity);
    const auto = lines.length > 0 ? latest + 0.3 : 2.4;
    const invalid = shot.hold !== undefined && !(Number.isFinite(shot.hold) && shot.hold > 0);
    const invalidIn = shot.in !== undefined && !(Number.isFinite(shot.in) && shot.in >= 0);
    const trimIn = shot.in !== undefined && !invalidIn ? shot.in : 0;
    const duration = shot.hold !== undefined && !invalid ? shot.hold : auto;
    const start = totalMicros / 1_000_000;
    totalMicros += Math.round(duration * 1_000_000);
    const end = totalMicros / 1_000_000;
    if (shot.id) {
      if (invalid) {
        findings.push({
          id: shot.id,
          code: "INVALID_HOLD",
          message: `Shot "${shot.id}" has hold ${shot.hold}; a hold must be a positive number of seconds, so the reading clock sets its length.`,
        });
      }
      if (invalidIn) {
        findings.push({
          id: shot.id,
          code: "INVALID_IN",
          message: `Shot "${shot.id}" has in ${shot.in}; an in-point must be a non-negative number of seconds.`,
        });
      }
      if (lines.some(line => line.end > duration + EPSILON)) {
        findings.push({
          id: shot.id,
          code: "SHOT_SHORTER_THAN_LINES",
          message: `Shot "${shot.id}" ends before its last line has finished.`,
        });
      }
      if (shot.still !== undefined && !(shot.still >= 0 && shot.still <= duration + EPSILON)) {
        findings.push({
          id: shot.id,
          code: "STILL_OUTSIDE_SHOT",
          message: `Shot "${shot.id}" asks for a still at ${shot.still}s, outside its ${quantize(duration)}s.`,
        });
      }
    }
    return {
      id: shot.id,
      text: shot.text ?? "",
      section: shot.section ?? null,
      fields: Object.freeze({ ...(shot.fields ?? {}) }),
      start,
      end,
      duration,
      in: trimIn,
      still: shot.still ?? 0.7 * duration,
      lines,
    };
  });
  const total = totalMicros / 1_000_000;
  const cues = shots.flatMap(shot => [
    ...(shot.id ? [{
      id: shot.id, start: quantize(shot.start), end: quantize(shot.end), still: quantize(shot.start + shot.still),
    }] : []),
    ...shot.lines.flatMap(({ block, start, end, still }) => block.id ? [{
      id: block.id,
      start: quantize(shot.start + start), end: quantize(shot.start + end), still: quantize(shot.start + still),
    }] : []),
  ]);
  return { shots, total, cues, findings };
}

/** The shot on screen at a film second; a cut frame belongs to the shot it starts. */
export function shotAt(shots: readonly TimedShot[], seconds: number) {
  return shots.find(shot => seconds < shot.end - EPSILON) ?? shots.at(-1)!;
}

/**
 * The duration to publish. The renderer counts `ceil(duration * fps)` frames
 * in floats, which turns 2.2 s at 25 fps into 56 frames. Count them in exact
 * decimals instead, and nudge the published duration only when it would miscount.
 */
export function publishedDuration(total: number, fps: number) {
  const seconds = quantize(total);
  const frames = Math.max(1, Math.ceil(Math.round(seconds * fps * 1e6) / 1e6));
  return { seconds: Math.ceil(seconds * fps) === frames ? seconds : seconds - 1e-6, frames };
}
