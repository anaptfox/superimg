// Race data and the ranking math behind it. The film reads from here so the
// upset is discovered in the numbers rather than written into the copy.

export interface Standing {
  label: string;
  value: number;
}

export interface Keyframe {
  time: number;
  rankings: Standing[];
}

/** US streaming subscribers (millions) — illustrative Q1→Q4 arc with a late upset. */
export const KEYFRAMES: readonly Keyframe[] = [
  { time: -1.5, rankings: [
    { label: "Netflix", value: 0 }, { label: "Disney+", value: 0 }, { label: "Max", value: 0 },
    { label: "Hulu", value: 0 }, { label: "Apple TV+", value: 0 },
  ] },
  { time: 0, rankings: [
    { label: "Netflix", value: 92 }, { label: "Disney+", value: 78 }, { label: "Max", value: 55 },
    { label: "Hulu", value: 48 }, { label: "Apple TV+", value: 42 },
  ] },
  { time: 1.5, rankings: [
    { label: "Netflix", value: 90 }, { label: "Disney+", value: 82 }, { label: "Max", value: 68 },
    { label: "Hulu", value: 50 }, { label: "Apple TV+", value: 44 },
  ] },
  { time: 3, rankings: [
    { label: "Netflix", value: 88 }, { label: "Disney+", value: 85 }, { label: "Max", value: 78 },
    { label: "Hulu", value: 52 }, { label: "Apple TV+", value: 46 },
  ] },
  { time: 4.5, rankings: [
    { label: "Netflix", value: 87 }, { label: "Max", value: 86 }, { label: "Disney+", value: 84 },
    { label: "Hulu", value: 53 }, { label: "Apple TV+", value: 47 },
  ] },
  { time: 6, rankings: [
    { label: "Max", value: 94 }, { label: "Netflix", value: 90 }, { label: "Disney+", value: 87 },
    { label: "Hulu", value: 54 }, { label: "Apple TV+", value: 49 },
  ] },
];

export const BRAND: Record<string, string> = {
  Netflix: "#E50914",
  "Disney+": "#4B7BFF",
  Max: "#8B5CF6",
  Hulu: "#1CE783",
  "Apple TV+": "#B9C0C6",
};

export const RACE_START = 0;
export const RACE_END = KEYFRAMES[KEYFRAMES.length - 1]!.time;
/** Opening order — also the lane order the bars grow into. */
export const LABELS = KEYFRAMES[1]!.rankings.map((r) => r.label);
export const AXIS_MAX = 100;

export function valuesAt(time: number): Map<string, number> {
  const out = new Map<string, number>();
  let lo = KEYFRAMES[0]!;
  let hi = KEYFRAMES[KEYFRAMES.length - 1]!;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (time >= KEYFRAMES[i]!.time && time <= KEYFRAMES[i + 1]!.time) {
      lo = KEYFRAMES[i]!;
      hi = KEYFRAMES[i + 1]!;
      break;
    }
  }
  const span = hi.time - lo.time || 1;
  const raw = Math.max(0, Math.min(1, (time - lo.time) / span));
  const k = raw * raw * (3 - 2 * raw); // smoothstep between quarters — no linear crawl
  for (const label of LABELS) {
    const a = lo.rankings.find((r) => r.label === label)?.value ?? 0;
    const b = hi.rankings.find((r) => r.label === label)?.value ?? 0;
    out.set(label, a + (b - a) * k);
  }
  return out;
}

export function leaderAt(time: number): string {
  const values = valuesAt(time);
  return LABELS.reduce(
    (best, label) => ((values.get(label) ?? 0) > (values.get(best) ?? 0) ? label : best),
    LABELS[0]!,
  );
}

export const OPENING_LEADER = leaderAt(RACE_START);
export const FINAL_LEADER = leaderAt(RACE_END);

/** The first moment the lead actually changes hands, or null if it never does. */
export const CROSS_TIME: number | null = (() => {
  if (FINAL_LEADER === OPENING_LEADER) return null;
  const steps = 240;
  for (let i = 1; i <= steps; i++) {
    const time = RACE_START + ((RACE_END - RACE_START) * i) / steps;
    if (leaderAt(time) !== OPENING_LEADER) return time;
  }
  return null;
})();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)));
  return k * k * (3 - 2 * k);
}

/** Fractional rank, so a pass is a slide rather than a teleport on the tie frame. */
function rankIn(table: Map<string, number>, label: string): number {
  const mine = table.get(label) ?? 0;
  return LABELS.reduce((acc, other) => {
    if (other === label) return acc;
    return acc + smoothstep(-2.6, 2.6, (table.get(other) ?? 0) - mine);
  }, 0);
}

export interface Lane {
  label: string;
  /** Positive while losing ground. Ascenders paint last so a pass reads as depth. */
  drift: number;
  y: number;
}

/**
 * Lane layout for one instant. Mid-swap two bars want the same row, so the climber
 * leads its own move, the one being passed lags, and a relaxation pass guarantees
 * they never overlap.
 */
export function lanesAt(time: number, rowH: number, barH: number, raceEnd: number): Lane[] {
  const now = valuesAt(time);
  const ahead = valuesAt(Math.min(raceEnd, time + 0.09));

  const lanes = LABELS.map((label, i) => {
    const rank = rankIn(now, label);
    const drift = rankIn(ahead, label) - rank;
    const tension = Math.min(1, Math.abs(rank - Math.round(rank)) * 2);
    const bow = (drift === 0 ? 0 : Math.sign(drift)) * tension * 0.34;
    // The i nudge keeps the all-zero opening stack from collapsing into one lane.
    return { label, drift, lane: rank + bow + i * 1e-3 };
  });

  const gap = (barH + 12) / rowH;
  lanes.sort((a, b) => a.lane - b.lane);
  for (let pass = 0; pass < 16; pass++) {
    for (let i = 0; i < lanes.length - 1; i++) {
      const a = lanes[i]!;
      const b = lanes[i + 1]!;
      const short = gap - (b.lane - a.lane);
      if (short > 0) {
        a.lane -= short / 2;
        b.lane += short / 2;
      }
    }
  }

  return lanes
    .map((l) => ({ label: l.label, drift: l.drift, y: l.lane * rowH + (rowH - barH) / 2 }))
    .sort((a, b) => b.drift - a.drift);
}
