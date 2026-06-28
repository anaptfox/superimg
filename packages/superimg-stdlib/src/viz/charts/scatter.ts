import { regressionLinear, regressionPoly, regressionLoess } from "d3-regression";
import type { CoordSystem } from "../coords.js";
import { linearScale } from "../scale.js";
import { makeLine } from "../d3-helpers.js";
import type { ChartOpts } from "./shared.js";
import { chartColors, drawDashAttrs, plotArea } from "./shared.js";

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
}

export type TrendType = "linear" | "polynomial" | "loess";

export interface TrendLineOpts {
  type?: TrendType;
  progress?: number;
  color?: string;
  strokeWidth?: number;
  order?: number;
}

export interface ScatterOpts extends ChartOpts {
  trendLine?: TrendLineOpts | boolean;
  showPointLabels?: boolean;
  labelFontSize?: number;
}

function sampleRegression(
  reg: Array<[number, number]> & { predict?: (x: number) => number },
  xMin: number,
  xMax: number,
  n = 24,
): Array<[number, number]> {
  if (reg.length > 2) return reg;
  if (typeof reg.predict !== "function") return reg;
  return Array.from({ length: n }, (_, i) => {
    const x = xMin + (i / (n - 1)) * (xMax - xMin);
    return [x, reg.predict!(x)] as [number, number];
  });
}

function regressionPoints(
  points: ScatterPoint[],
  type: TrendType,
  order = 3,
): Array<[number, number]> {
  const data = points.map((p) => [p.x, p.y] as [number, number]);
  const xMin = Math.min(...points.map((p) => p.x));
  const xMax = Math.max(...points.map((p) => p.x));
  if (type === "polynomial") {
    const reg = regressionPoly().x((d) => d[0]).y((d) => d[1]).order(order)(data) as Array<
      [number, number]
    > & { predict?: (x: number) => number };
    return sampleRegression(reg, xMin, xMax);
  }
  if (type === "loess") {
    return regressionLoess().x((d) => d[0]).y((d) => d[1])(data) as Array<[number, number]>;
  }
  const reg = regressionLinear().x((d) => d[0]).y((d) => d[1])(data) as Array<
    [number, number]
  > & { predict?: (x: number) => number };
  return sampleRegression(reg, xMin, xMax);
}

export function scatter(
  coords: CoordSystem,
  points: ScatterPoint[],
  xDomain?: [number, number],
  yDomain?: [number, number],
  opts: ScatterOpts = {},
): string {
  const progress = opts.progress ?? 1;
  const area = plotArea(coords, opts.padding ?? 8);
  const xDom = xDomain ?? coords.config.xRange;
  const yDom = yDomain ?? coords.config.yRange;
  const x = linearScale(xDom, [area.left, area.left + area.width]);
  const y = linearScale(yDom, [area.top + area.height, area.top]);
  const colors = chartColors(opts);
  const n = points.length;
  const labelSize = opts.labelFontSize ?? 11;

  const dots = points
    .map((p, i) => {
      const threshold = (i + 1) / n;
      if (progress < threshold - 1 / n) return "";
      const local = Math.min(1, (progress - i / n) * n);
      const r = 5 + 3 * local;
      const color = colors[i % colors.length]!;
      const cx = x(p.x)!.toFixed(2);
      const cy = y(p.y)!.toFixed(2);
      let labelEl = "";
      if (opts.showPointLabels && p.label) {
        labelEl = `<text x="${cx}" y="${(Number(cy) - r - 4).toFixed(2)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="#94a3b8" opacity="${(0.85 * local).toFixed(3)}">${p.label}</text>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${color}" opacity="${(0.85 * local).toFixed(3)}"/>${labelEl}`;
    })
    .filter(Boolean)
    .join("\n");

  const trendCfg =
    opts.trendLine === true
      ? { type: "linear" as TrendType, progress: 1, color: "#94a3b8", strokeWidth: 2.5 }
      : opts.trendLine
        ? {
            type: "linear" as TrendType,
            progress: 1,
            color: "#94a3b8",
            strokeWidth: 2.5,
            ...opts.trendLine,
          }
        : null;

  if (!trendCfg || trendCfg.progress <= 0 || points.length < 2) return dots;

  const regPts = regressionPoints(points, trendCfg.type ?? "linear", trendCfg.order);
  const pixelPts = regPts.map(([rx, ry]) => ({ px: x(rx)!, py: y(ry)! }));
  const lineGen = makeLine({ x: (p) => p.px, y: (p) => p.py, curve: "linear" });
  const lineD = lineGen(pixelPts) ?? "";
  const dash = drawDashAttrs(lineD, trendCfg.progress);
  const strokeColor = trendCfg.color ?? "#94a3b8";
  const sw = trendCfg.strokeWidth ?? 2.5;

  const trend = `<path d="${lineD}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash.strokeDasharray}" stroke-dashoffset="${dash.strokeDashoffset}" opacity="0.9"/>`;

  return `${dots}\n${trend}`;
}