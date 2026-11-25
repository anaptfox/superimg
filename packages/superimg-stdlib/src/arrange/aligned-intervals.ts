import { Frame, Fill, Stack, Text } from "../tree/primitives.js";
import { h } from "../tree/h.js";
import type { MediaElement } from "../tree/node-types.js";
import {
  DEFAULT_SIZE,
  HAIR,
  INK,
  checkBase,
  chip,
  fail,
  label,
  throwIf,
} from "./base.js";
import { arrangementShell } from "./chrome.js";
import type { AlignedIntervalsSpec, ArrangeFailure, Interval, IntervalTrack } from "./types.js";

function spanOf(spec: AlignedIntervalsSpec): { min: number; max: number } | null {
  const values: number[] = [spec.timeRef.origin];
  for (const track of spec.tracks ?? []) {
    for (const interval of track.intervals ?? []) {
      values.push(interval.start, interval.end);
    }
  }
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

function intervalFailures(trackId: string, interval: Interval, index: number): ArrangeFailure[] {
  const failures: ArrangeFailure[] = [];
  if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end)) {
    failures.push(
      fail("missing-time-ref", `Track ${trackId} interval ${index} needs finite start and end.`),
    );
    return failures;
  }
  if (interval.end < interval.start) {
    failures.push(
      fail("unaligned-frame", `Track ${trackId} interval ${index} ends before it starts.`),
    );
  }
  return failures;
}

export function checkAlignedIntervals(spec: AlignedIntervalsSpec): ArrangeFailure[] {
  const failures = [...checkBase(spec)];
  if (!spec.timeRef || !spec.timeRef.unit || !Number.isFinite(spec.timeRef.origin)) {
    failures.push(fail("missing-time-ref", "Aligned intervals need a shared timeRef (unit + origin)."));
  }
  if (!spec.tracks?.length) {
    failures.push(fail("missing-correspondence", "Provide at least one track of intervals."));
  }
  for (const track of spec.tracks ?? []) {
    if (!track.id) {
      failures.push(fail("missing-correspondence", "Every track needs a stable id."));
    }
    if (!track.intervals?.length) {
      failures.push(fail("missing-time-ref", `Track ${track.id || "?"} has no intervals.`));
    }
    track.intervals?.forEach((interval, index) => {
      failures.push(...intervalFailures(track.id || "?", interval, index));
    });
  }
  const span = spec.tracks ? spanOf(spec) : null;
  if (span && span.max === span.min) {
    failures.push(
      fail("unaligned-frame", "Intervals share one instant; there is no duration to align."),
    );
  }
  const ids = (spec.tracks ?? []).map(track => track.id);
  if (new Set(ids).size !== ids.length) failures.push(fail("missing-correspondence", "Track ids must be distinct."));
  const size = spec.size ?? DEFAULT_SIZE;
  // Reserve at least 80 px per track in the plot's stage-height budget.
  // This is a structural limit, not a claim that arbitrary text will fit.
  if ((spec.tracks?.length ?? 0) * 80 > size.height * (size.height > size.width ? 0.42 : 0.26)) {
    failures.push(fail("too-dense", "The requested canvas cannot provide 80 pixels per track within the plot area; use a taller canvas or split the tracks."));
  }
  if (spec.compare) {
    const [first, second] = spec.compare.tracks;
    if (!first || !second || first === second || !ids.includes(first) || !ids.includes(second)) {
      failures.push(fail("missing-correspondence", "Overlap comparison needs two distinct existing track ids."));
    }
  }
  failures.push(...checkPredict(spec));
  return failures;
}

/** Closed intersections; touching is retained as a zero-duration contact. */
export function overlapSegments(first: IntervalTrack, second: IntervalTrack): Array<{ start: number; end: number; uncertain: boolean }> {
  const intersections = first.intervals.flatMap(a => second.intervals.flatMap(b => {
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    return start <= end ? [{ start, end, uncertain: !!(a.uncertain || b.uncertain) }] : [];
  })).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof intersections = [];
  for (const part of intersections) {
    const previous = merged[merged.length - 1];
    if (previous && part.start <= previous.end) {
      previous.end = Math.max(previous.end, part.end);
      previous.uncertain ||= part.uncertain;
    } else merged.push({ ...part });
  }
  return merged;
}

function checkPredict(spec: AlignedIntervalsSpec): ArrangeFailure[] {
  const motion = spec.motion;
  if (!motion || motion.phase === "reveal" || motion.phase === "hold") return [];
  const ids = motion.revealIds ?? [];
  if (ids.length === 0) {
    return [
      fail(
        "predict-spoils",
        "Predict needs revealIds so the answer tracks can stay ticks/empty instead of full ink.",
      ),
    ];
  }
  const known = new Set((spec.tracks ?? []).map((track) => track.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    return [fail("predict-spoils", `revealIds not in tracks: ${missing.join(", ")}`)];
  }
  if (ids.length === (spec.tracks?.length ?? 0)) {
    return [
      fail(
        "predict-spoils",
        "Predict that hides every track leaves no context. Keep at least one context track.",
      ),
    ];
  }
  return [];
}

function answerSet(spec: AlignedIntervalsSpec): Set<string> {
  return new Set(spec.motion?.revealIds ?? []);
}

function visibleTracks(spec: AlignedIntervalsSpec, phase: "hold" | "predict" | "reveal"): IntervalTrack[] {
  const answers = answerSet(spec);
  if (answers.size === 0) return spec.tracks;
  if (phase === "reveal" || phase === "predict") return spec.tracks;
  return spec.tracks.filter((track) => !answers.has(track.id));
}

export function alignedIntervals(spec: AlignedIntervalsSpec, phaseOverride?: "hold" | "predict" | "reveal"): MediaElement {
  throwIf(checkAlignedIntervals(spec));
  const size = spec.size ?? DEFAULT_SIZE;
  const inner = size.width - 96;
  const span = spanOf(spec)!;
  const range = span.max - span.min;
  const portrait = size.height > size.width;
  const trackH = Math.min(180, Math.floor(size.height * (portrait ? 0.42 : 0.26) / Math.max(2, spec.tracks.length)));
  const barH = Math.min(64, Math.round(trackH * 0.46));
  const labelW = Math.max(220, Math.min(440, Math.floor(inner * 0.36)));
  const plotW = inner - labelW - 12;
  const trackSize = 48;
  const axisSize = 42;

  const xOf = (value: number) => Math.round(((value - span.min) / range) * plotW);
  const wOf = (interval: Interval) => Math.max(3, xOf(interval.end) - xOf(interval.start));

  const phase = phaseOverride ?? spec.motion?.phase ?? "hold";
  const predictMode = spec.motion?.predict ?? "tick";
  const answers = answerSet(spec);
  const tracks = visibleTracks(spec, phase).map((track) => {
    const predicting = phase === "predict" && answers.has(track.id);
    const bars = predicting && predictMode === "empty"
      ? []
      : track.intervals.map((interval, index) => {
          const tick = predicting;
          return Frame(
            {
              id: interval.id ?? `${track.id}-${index}`,
              x: xOf(interval.start),
              y: Math.round((trackH - barH) / 2),
              width: tick ? 3 : wOf(interval),
              height: barH,
              radius: 3,
            },
            Fill({
              color: tick
                ? predictMode === "ghost"
                  ? "rgba(28,30,34,0.28)"
                  : INK
                : interval.uncertain
                  ? "rgba(28,30,34,0.28)"
                  : INK,
            }),
          );
        });
    const trackLabel = predicting ? `${track.label} ?` : track.label;
    // Keep the row's height intrinsic: a wrapped label may be taller than
    // the plot. Stack() infers fill height for align:center, so use the same
    // primitive without that inferred size to let layout measure both peers.
    return h(
      "Stack", { direction: "row", gap: 12, align: "center", width: inner },
      Frame({ width: labelW }, label(`track-${track.id}`, trackLabel, trackSize)),
      Frame(
        { id: `plot-${track.id}`, width: plotW, height: trackH, radius: 4 },
        Fill({ color: "rgba(28,30,34,0.04)" }),
        Fill({ y: trackH / 2, height: 1, width: plotW, color: HAIR }),
        ...bars,
      ),
    );
  });

  // Endpoints already have values. An interior origin needs its own label and
  // a tick connected to the shared axis so its position is unambiguous.
  const originX = xOf(spec.timeRef.origin);
  const interiorOrigin = spec.timeRef.origin !== span.min && spec.timeRef.origin !== span.max;
  const axis = Frame(
    { width: plotW, height: 120 },
    Frame({ x: 0, y: 58, width: plotW, height: 1 }, Fill({ color: HAIR })),
    interiorOrigin ? Frame({ id: "origin-marker", x: originX, y: 50, width: 2, height: 17 }, Fill({ color: INK })) : null,
    interiorOrigin ? Frame({ x: Math.min(Math.max(0, originX - 160), Math.max(0, plotW - 320)), width: Math.min(320, plotW), height: 50 },
      label("t-origin", `origin ${spec.timeRef.origin}`, axisSize)) : null,
    Frame({ x: 0, y: 66, width: Math.max(1, plotW / 2 - 8), height: 52 }, label("t-min", `${span.min} ${spec.timeRef.unit}`, axisSize)),
    Frame({ x: plotW / 2 + 8, y: 66, width: Math.max(1, plotW / 2 - 8), height: 52 },
      Stack({ width: "fill", direction: "row", justify: "end" }, label("t-max", `${span.max} ${spec.timeRef.unit}`, axisSize))),
  );

  const compareVisible = spec.compare && (phaseOverride === undefined && !spec.motion || phase === "reveal");
  const participants = compareVisible ? spec.compare!.tracks.map(id => spec.tracks.find(track => track.id === id)!) : [];
  const intersections = participants.length ? overlapSegments(participants[0]!, participants[1]!) : [];
  const uncertainInput = participants.some(track => track.intervals.some(interval => interval.uncertain));
  const answerText = intersections.length === 0
    ? uncertainInput ? "No overlap in shown intervals (timing uncertain)" : "No overlap"
    : intersections.map(segment => `${segment.uncertain ? "Uncertain: " : ""}${segment.start === segment.end ? `touch at ${segment.start}` : `${segment.start}–${segment.end}`} ${spec.timeRef.unit}`).join(" · ");
  const answerH = Math.max(56, Math.floor(trackH * 0.5));
  const answerBarH = Math.min(64, Math.round(answerH * 0.46));
  const answer = compareVisible ? Stack(
    { width: inner, gap: portrait ? 48 : 36 },
    Stack({ direction: "row", width: inner, height: answerH, gap: 12, align: "center" },
      Frame({ width: labelW }, label("overlap-label", "Overlap", trackSize)),
      Frame({ id: "overlap-plot", width: plotW, height: answerH },
        Fill({ color: "rgba(28,30,34,0.04)" }),
        ...intersections.map((segment, index) => Frame(
          { id: `overlap-${index}`, x: xOf(segment.start), y: Math.round((answerH - answerBarH) / 2), width: Math.max(3, xOf(segment.end) - xOf(segment.start)), height: answerBarH, radius: 3 },
          Fill({ color: segment.uncertain ? "rgba(28,30,34,0.28)" : INK }),
        )),
      ),
    ),
    Stack({ gap: 8 },
      Text({ id: "overlap-answer", size: 48, weight: 700, color: INK }, `${participants[0]!.label} / ${participants[1]!.label}: ${answerText}`),
      Text({ id: "overlap-caveat", size: 36, color: INK }, "Overlap shows timing, not causation."),
    ),
  ) : null;

  const body = Stack(
    // A two-track view without an answer has fewer elements to occupy the
    // stage. Distribute those rows instead of crowding them into its top half.
    { gap: portrait ? tracks.length <= 2 ? 128 : 32 : !compareVisible && tracks.length === 2 ? 40 : 14 },
    spec.timeRef.originLabel ? label("origin-description", spec.timeRef.originLabel, axisSize) : null,
    Frame({ x: labelW + 12, width: plotW, height: 120 }, axis),
    ...tracks,
    answer,
  );

  return arrangementShell(
    spec,
    [chip("unit", `Time: ${spec.timeRef.unit}`, 28), ...(!interiorOrigin && spec.timeRef.origin !== 0 ? [chip("origin", `origin ${spec.timeRef.origin}`, 28)] : [])],
    body,
    { titleSize: 48, chipSize: 28, sourceSize: 36 },
  );
}
