import { video } from "@superimg/types";
import { arrange } from "@superimg/stdlib/arrange";
import type {
  AlignedIntervalsSpec,
  IntervalMotionPhase,
  IntervalTrack,
  ValueAgainstReferenceSpec,
} from "@superimg/stdlib/arrange";

export type CortexEvent = { id?: string; at: string; label: string };
export type CortexMetric = { id?: string; label: string; value: string; reference?: number };

export const eventStorySample = {
  headline: "How did yesterday's launch go?",
  intent: "decision_support",
  events: [
    { id: "launch", at: "10:05", label: "LAUNCH" },
    { id: "hotfix", at: "14:22", label: "hotfix" },
  ] as CortexEvent[],
  metrics: [] as CortexMetric[],
  evidence: [] as string[],
  attention: "",
};

export const dailyReportSample = {
  headline: "How are we doing?",
  intent: "status",
  events: [] as CortexEvent[],
  metrics: [
    { id: "users", label: "Users", value: "512" },
    { id: "revenue", label: "Revenue", value: "1640" },
  ] as CortexMetric[],
  evidence: [] as string[],
  attention: "",
};

function slug(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || `item-${index}`;
}

export function parseEventMinutes(at: string, index: number): number {
  if (!at.trim()) return index * 10;
  const asNum = Number(at);
  if (Number.isFinite(asNum)) return asNum;
  const hm = /^(\d{1,2}):(\d{2})/.exec(at);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const ms = Date.parse(at);
  if (Number.isFinite(ms)) return Math.round(ms / 60000);
  return index * 10;
}

export function eventStoryPhase(progress: number): IntervalMotionPhase {
  if (progress >= 0.65) return "reveal";
  if (progress >= 0.3) return "predict";
  return "hold";
}

export function eventStorySpec(
  data: typeof eventStorySample,
  phase: IntervalMotionPhase,
): AlignedIntervalsSpec {
  const tracks: IntervalTrack[] = data.events.map((event, index) => {
    const start = parseEventMinutes(event.at, index);
    return {
      id: event.id ?? slug(event.label, index),
      label: event.label,
      intervals: [{ start, end: start + 8, label: event.label }],
    };
  });
  const revealIds = tracks.length > 1 ? [tracks[tracks.length - 1]!.id] : [];
  return {
    question: data.headline,
    workRemoved: "Computing order and concurrency across separate event records",
    evidence: "derived",
    timeRef: { unit: "min", origin: 0, originLabel: "start" },
    tracks,
    ...(revealIds.length > 0 ? { motion: { phase, predict: "tick", revealIds } } : {}),
    source: data.evidence[0] ?? data.attention,
  };
}

export function dailyReportSpec(data: typeof dailyReportSample): ValueAgainstReferenceSpec {
  const [first, ...rest] = data.metrics.map((metric, index) => ({
    id: metric.id ?? slug(metric.label, index),
    label: metric.label,
    value: metric.value,
    ...(metric.reference !== undefined ? { reference: metric.reference } : {}),
  }));
  const source = data.evidence.join(" · ") || data.attention;
  return {
    question: data.headline,
    workRemoved: "Remembering a baseline while scanning current values",
    evidence: "derived",
    items: [first ?? { id: "empty", label: "No metrics", value: "—" }, ...rest],
    frame: { scale: "per-item" },
    ...(source ? { source } : {}),
  };
}

const square = { size: { width: 1080, height: 1080 } } as const;

export const eventStoryMedia = video<typeof eventStorySample>({
  duration: "8s",
  size: square.size,
  sample: eventStorySample,
  editions: { square },
  render(ctx) {
    return arrange.alignedIntervals(eventStorySpec(ctx.data, eventStoryPhase(ctx.timeline.progress)));
  },
});

export const dailyReportMedia = video<typeof dailyReportSample>({
  duration: "6s",
  size: square.size,
  sample: dailyReportSample,
  editions: { square },
  render(ctx) {
    return arrange.valueAgainstReference(dailyReportSpec(ctx.data));
  },
});
