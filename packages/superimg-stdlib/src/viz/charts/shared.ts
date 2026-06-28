import type { CoordSystem } from "../coords.js";
import { linearScale } from "../scale.js";
import { draw as svgDraw } from "../../svg/draw.js";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  id: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartScaleOpts {
  yDomain?: [number, number];
  xDomain?: [number, number];
}

export interface ChartOpts extends ChartScaleOpts {
  progress?: number;
  colors?: string[];
  animate?: "grow" | "draw" | "fade";
  padding?: number;
}

export interface PlotArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ChartScales {
  x: ReturnType<typeof linearScale>;
  y: ReturnType<typeof linearScale>;
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
  baseline: number;
}

export const DEFAULT_CHART_COLORS = [
  "#5b8cff",
  "#f093fb",
  "#4fd1c5",
  "#ffc857",
  "#667eea",
  "#ef4444",
];

export function chartColors(opts?: ChartOpts): string[] {
  return opts?.colors ?? DEFAULT_CHART_COLORS;
}

export function animOpacity(progress = 1, mode: ChartOpts["animate"] = "fade"): number {
  if (mode === "fade") return progress;
  return 1;
}

export function plotArea(coords: CoordSystem, pad = 0): PlotArea {
  return {
    left: coords.plotLeft + pad,
    top: coords.plotTop + pad,
    width: coords.plotWidth - pad * 2,
    height: coords.plotHeight - pad * 2,
  };
}

/** Shared x/y scales mapped to coords ranges (aligns charts with axes/grid). */
export function chartScales(
  coords: CoordSystem,
  area: PlotArea,
  opts?: ChartScaleOpts,
): ChartScales {
  const [yMin, yMax] = opts?.yDomain ?? coords.config.yRange;
  const [xMin, xMax] = opts?.xDomain ?? coords.config.xRange;
  const y = linearScale([yMin, yMax], [area.top + area.height, area.top]);
  const x = linearScale([xMin, xMax], [area.left, area.left + area.width]);
  const baseline = y(yMin)!;
  return { x, y, yMin, yMax, xMin, xMax, baseline };
}

/** Interpolate a numeric value between keyframes at `time`. */
export function interpolateKeyframes(
  keyframes: Array<{ time: number; values: Map<string, number> }>,
  time: number,
  label: string,
): number {
  if (keyframes.length === 0) return 0;
  if (time <= keyframes[0]!.time) return keyframes[0]!.values.get(label) ?? 0;
  const last = keyframes[keyframes.length - 1]!;
  if (time >= last.time) return last.values.get(label) ?? 0;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1;
      const t = (time - a.time) / span;
      const va = a.values.get(label) ?? 0;
      const vb = b.values.get(label) ?? 0;
      return va + (vb - va) * t;
    }
  }
  return last.values.get(label) ?? 0;
}

export function drawDashAttrs(
  pathD: string,
  progress: number,
): { strokeDasharray: string; strokeDashoffset: string } {
  const result = svgDraw(pathD, progress);
  return {
    strokeDasharray: result.strokeDasharray,
    strokeDashoffset: result.strokeDashoffset,
  };
}