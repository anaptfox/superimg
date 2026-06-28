import type { CoordSystem } from "../coords.js";
import { bandScale, linearScale, timeScale } from "../scale.js";
import { makeLine, makeArea, type CurveName } from "../d3-helpers.js";
import { formatDate } from "../../date.js";
import type { ChartDataPoint, ChartOpts } from "./shared.js";
import { animOpacity, chartColors, chartScales, drawDashAttrs, plotArea } from "./shared.js";

export interface LineChartOpts extends ChartOpts {
  curve?: CurveName;
  tension?: number;
  fill?: boolean;
  fillOpacity?: number;
  showPoints?: boolean;
  pointRadius?: number;
  showLabels?: boolean;
  labelFontSize?: number;
  labelColor?: string;
  defined?: (d: ChartDataPoint) => boolean;
}

export interface TimeDataPoint {
  date: string | Date;
  value: number;
}

export interface LineTimeOpts extends LineChartOpts {
  showDateLabels?: boolean;
}

function parseDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

interface ResolvedPoint {
  datum: ChartDataPoint;
  px: number;
  py: number;
  animatedValue: number;
}

function resolvePoints(
  coords: CoordSystem,
  data: ChartDataPoint[],
  opts: LineChartOpts,
): { points: ResolvedPoint[]; labels: string } {
  const area = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, area, opts);
  const grow = opts.animate === "grow" ? (opts.progress ?? 1) : 1;
  const labelSize = opts.labelFontSize ?? 11;
  const labelColor = opts.labelColor ?? "#6b7795";

  const cats = data.map((d) => d.label);
  const xBand = bandScale(cats, [area.left, area.left + area.width], 0.08);
  const bw = xBand.bandwidth();

  const points: ResolvedPoint[] = data.map((d) => {
    const animatedValue = scales.yMin + (d.value - scales.yMin) * grow;
    return {
      datum: d,
      px: (xBand(d.label) ?? area.left) + bw / 2,
      py: scales.y(animatedValue)!,
      animatedValue,
    };
  });

  let labels = "";
  if (opts.showLabels) {
    labels = points
      .map((p) => {
        const ly = area.top + area.height + labelSize + 4;
        return `<text x="${p.px.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}">${p.datum.label}</text>`;
      })
      .join("\n");
  }

  return { points, labels };
}

function renderLinePath(
  points: ResolvedPoint[],
  opts: LineChartOpts,
  color: string,
): string {
  const definedFn = opts.defined ?? (() => true);
  const lineGen = makeLine<ResolvedPoint>({
    x: (p) => p.px,
    y: (p) => p.py,
    curve: opts.curve ?? "monotone",
    tension: opts.tension,
    defined: (p) => definedFn(p.datum),
  });
  const pathD = lineGen(points) ?? "";
  const progress = opts.progress ?? 1;
  const opacity = animOpacity(progress, opts.animate);
  const sw = 3;

  if (opts.animate === "draw" && pathD) {
    const dash = drawDashAttrs(pathD, progress);
    return `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash.strokeDasharray}" stroke-dashoffset="${dash.strokeDashoffset}" opacity="${opacity.toFixed(3)}"/>`;
  }
  return `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`;
}

function renderAreaPath(
  points: ResolvedPoint[],
  coords: CoordSystem,
  opts: LineChartOpts,
  color: string,
): string {
  const area = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, area, opts);
  const definedFn = opts.defined ?? (() => true);
  const progress = opts.progress ?? 1;
  const fillOp = (opts.fillOpacity ?? 0.35) * (opts.animate === "grow" ? progress : 1);

  const areaGen = makeArea<ResolvedPoint>({
    x: (p) => p.px,
    y0: scales.baseline,
    y1: (p) => p.py,
    curve: opts.curve ?? "monotone",
    tension: opts.tension,
    defined: (p) => definedFn(p.datum),
  });
  const fillD = areaGen(points) ?? "";

  if (opts.animate === "draw") {
    const clipW = area.width * progress;
    const clipId = `area-clip-${Math.round(area.left)}-${Math.round(area.top)}`;
    return `<defs><clipPath id="${clipId}"><rect x="${area.left}" y="${area.top}" width="${clipW.toFixed(2)}" height="${area.height}"/></clipPath></defs><path d="${fillD}" fill="${color}" opacity="${fillOp.toFixed(3)}" clip-path="url(#${clipId})"/>`;
  }

  return `<path d="${fillD}" fill="${color}" opacity="${fillOp.toFixed(3)}"/>`;
}

function renderPoints(points: ResolvedPoint[], opts: LineChartOpts, color: string): string {
  if (!opts.showPoints) return "";
  const r = opts.pointRadius ?? 5;
  const progress = opts.progress ?? 1;
  return points
    .map(
      (p) =>
        `<circle cx="${p.px.toFixed(2)}" cy="${p.py.toFixed(2)}" r="${r}" fill="${color}" opacity="${progress.toFixed(3)}"/>`,
    )
    .join("\n");
}

export function line(
  coords: CoordSystem,
  data: ChartDataPoint[],
  opts: LineChartOpts = {},
): string {
  const { points, labels } = resolvePoints(coords, data, opts);
  const color = chartColors(opts)[0]!;
  const parts: string[] = [];

  if (opts.fill) parts.push(renderAreaPath(points, coords, opts, color));
  parts.push(renderLinePath(points, opts, color));
  parts.push(renderPoints(points, opts, color));
  if (labels) parts.push(labels);

  return parts.filter(Boolean).join("\n");
}

export function lineTime(
  coords: CoordSystem,
  data: TimeDataPoint[],
  opts: LineTimeOpts = {},
): string {
  if (data.length === 0) return "";
  const progress = opts.progress ?? 1;
  const areaBox = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, areaBox, opts);
  const color = chartColors(opts)[0]!;
  const dates = data.map((d) => parseDate(d.date));
  const x = timeScale(
    [dates[0]!, dates[dates.length - 1]!],
    [areaBox.left, areaBox.left + areaBox.width],
  );
  const grow = opts.animate === "grow" ? progress : 1;

  const resolved: ResolvedPoint[] = data.map((d) => {
    const animatedValue = scales.yMin + (d.value - scales.yMin) * grow;
    return {
      datum: { label: String(d.date), value: d.value },
      px: x(parseDate(d.date))!,
      py: scales.y(animatedValue)!,
      animatedValue,
    };
  });

  const parts: string[] = [];
  if (opts.fill) parts.push(renderAreaPath(resolved, coords, opts, color));
  parts.push(renderLinePath(resolved, opts, color));
  parts.push(renderPoints(resolved, opts, color));

  if (opts.showDateLabels) {
    const labelSize = opts.labelFontSize ?? 11;
    const labelColor = opts.labelColor ?? "#6b7795";
    const step = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += step) {
      const dt = dates[i]!;
      const px = x(dt)!;
      const ly = areaBox.top + areaBox.height + labelSize + 4;
      parts.push(
        `<text x="${px.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}">${formatDate(dt, "MMM yy")}</text>`,
      );
    }
  }

  return parts.filter(Boolean).join("\n");
}