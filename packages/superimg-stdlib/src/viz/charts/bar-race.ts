import type { CoordSystem } from "../coords.js";
import type { ChartDataPoint } from "./shared.js";
import type { BarHorizontalOpts } from "./bar-horizontal.js";
import { animOpacity, chartColors, chartScales, interpolateKeyframes, plotArea } from "./shared.js";

export interface BarRaceKeyframe {
  time: number;
  rankings: ChartDataPoint[];
}

export interface BarRaceOpts extends BarHorizontalOpts {
  rowGap?: number;
  /** Lock a color to each entity — colors never follow rank slots */
  colorByLabel?: Record<string, string>;
  /** Slightly brighten the current #1 bar */
  emphasizeLeader?: boolean;
}

function buildKeyframeMaps(keyframes: BarRaceKeyframe[]) {
  return keyframes.map((kf) => {
    const values = new Map<string, number>();
    for (const r of kf.rankings) values.set(r.label, r.value);
    return { time: kf.time, values };
  });
}

function ranksAtKeyframe(keyframe: BarRaceKeyframe): Map<string, number> {
  const sorted = [...keyframe.rankings].sort((a, b) => b.value - a.value);
  const ranks = new Map<string, number>();
  sorted.forEach((d, i) => ranks.set(d.label, i));
  return ranks;
}

function findSegment(
  keyframes: BarRaceKeyframe[],
  timeSeconds: number,
): { index: number; t: number } {
  if (keyframes.length === 1) return { index: 0, t: 0 };
  if (timeSeconds <= keyframes[0]!.time) return { index: 0, t: 0 };
  const last = keyframes[keyframes.length - 1]!;
  if (timeSeconds >= last.time) {
    return { index: Math.max(0, keyframes.length - 2), t: 1 };
  }
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (timeSeconds >= a.time && timeSeconds <= b.time) {
      const span = b.time - a.time || 1;
      return { index: i, t: (timeSeconds - a.time) / span };
    }
  }
  return { index: Math.max(0, keyframes.length - 2), t: 1 };
}

function displayRank(
  keyframes: BarRaceKeyframe[],
  label: string,
  timeSeconds: number,
  fallbackRank: number,
): number {
  const { index, t } = findSegment(keyframes, timeSeconds);
  const startRanks = ranksAtKeyframe(keyframes[index]!);
  const endKeyframe = keyframes[index + 1] ?? keyframes[index]!;
  const endRanks = ranksAtKeyframe(endKeyframe);
  const rs = startRanks.get(label) ?? fallbackRank;
  const re = endRanks.get(label) ?? fallbackRank;
  return rs + (re - rs) * t;
}

function resolveBarColor(
  label: string,
  allLabels: string[],
  opts: BarRaceOpts,
): string {
  if (opts.colorByLabel?.[label]) return opts.colorByLabel[label];
  const colors = chartColors(opts);
  const domain = [...allLabels].sort();
  const idx = domain.indexOf(label);
  return colors[idx % colors.length]!;
}

function maxKeyframeValue(keyframes: BarRaceKeyframe[]): number {
  return Math.max(0, ...keyframes.flatMap((kf) => kf.rankings.map((r) => r.value)));
}

export function barRace(
  coords: CoordSystem,
  keyframes: BarRaceKeyframe[],
  timeSeconds: number,
  opts: BarRaceOpts = {},
): string {
  if (keyframes.length === 0) return "";
  const area = plotArea(coords, opts.padding ?? 8);
  const dataMax = maxKeyframeValue(keyframes);
  const scaleOpts = {
    ...opts,
    xDomain: opts.xDomain ?? ([0, Math.ceil(dataMax * 1.05)] as [number, number]),
  };
  const scales = chartScales(coords, area, scaleOpts);
  const maps = buildKeyframeMaps(keyframes);
  const allLabels = [...new Set(keyframes.flatMap((kf) => kf.rankings.map((r) => r.label)))];
  const fallbackRank = allLabels.length - 1;

  const current: ChartDataPoint[] = allLabels.map((label) => ({
    label,
    value: interpolateKeyframes(maps, timeSeconds, label),
  }));
  current.sort((a, b) => b.value - a.value);
  const leaderLabel = current[0]?.label;

  const n = allLabels.length;
  const rowGap = opts.rowGap ?? 0.12;
  const slotHeight = area.height / n;
  const gap = slotHeight * rowGap;
  const barHeight = slotHeight - gap;

  const labelSide = opts.labelSide ?? "left";
  const opacity = animOpacity(1, opts.animate);
  const xOrigin = scales.x(scales.xMin)!;
  const labelSize = opts.labelFontSize ?? 13;
  const labelColor = opts.labelColor ?? "#e2e8f0";
  const emphasizeLeader = opts.emphasizeLeader ?? true;
  const parts: string[] = [];

  const drawOrder = [...allLabels].sort((a, b) => {
    const ra = displayRank(keyframes, a, timeSeconds, fallbackRank);
    const rb = displayRank(keyframes, b, timeSeconds, fallbackRank);
    return rb - ra;
  });

  for (const label of drawOrder) {
    const value = interpolateKeyframes(maps, timeSeconds, label);
    const rank = displayRank(keyframes, label, timeSeconds, fallbackRank);
    const by = area.top + rank * slotHeight + gap / 2;
    const xEnd = scales.x(value)!;
    const w = Math.max(0, xEnd - xOrigin);
    const color = resolveBarColor(label, allLabels, opts);
    const isLeader = emphasizeLeader && label === leaderLabel;
    const barOpacity = isLeader ? opacity : opacity * 0.88;
    const r = opts.barRadius ?? 4;
    const ly = by + barHeight / 2 + labelSize * 0.35;

    const rectAttrs = [
      `x="${xOrigin.toFixed(2)}"`,
      `y="${by.toFixed(2)}"`,
      `width="${w.toFixed(2)}"`,
      `height="${barHeight.toFixed(2)}"`,
      `rx="${r}"`,
      `fill="${color}"`,
      `opacity="${barOpacity.toFixed(3)}"`,
    ];
    if (isLeader) {
      rectAttrs.push(`stroke="#f0f4ff"`, `stroke-width="1.5"`, `stroke-opacity="0.35"`);
    }
    parts.push(`<rect ${rectAttrs.join(" ")}/>`);

    if (opts.showLabels) {
      const labelX =
        labelSide === "right" ? area.left + area.width + 8 : area.left - 8;
      const anchor = labelSide === "right" ? "start" : "end";
      const weight = isLeader ? "700" : "600";
      parts.push(
        `<text x="${labelX.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" font-family="Inter,sans-serif" font-size="${labelSize}" font-weight="${weight}" fill="${labelColor}">${label}</text>`,
      );
    }
    if (opts.showValueLabels && w > 40) {
      parts.push(
        `<text x="${(xEnd - 8).toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="end" font-family="Inter,sans-serif" font-size="${opts.valueLabelFontSize ?? 12}" font-weight="700" fill="#f0f4ff">${Math.round(value)}</text>`,
      );
    }
  }

  return parts.join("\n");
}