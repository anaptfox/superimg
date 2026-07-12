import {
  stack as d3Stack,
  stackOffsetNone,
  stackOffsetExpand,
  stackOrderNone,
  area as d3Area,
} from "d3-shape";
import type { CoordSystem } from "../coords.js";
import { bandScale, linearScale } from "../scale.js";
import { resolveCurve, type CurveName } from "../d3-helpers.js";
import type { ChartSeries, ChartOpts } from "./shared.js";
import { animOpacity, chartColors, plotArea } from "./shared.js";

export type StackOffset = "none" | "expand";

export interface StackChartOpts extends ChartOpts {
  /** `"bar"` (default) or `"area"` stacked series. */
  mode?: "bar" | "area";
  curve?: CurveName;
  tension?: number;
  barRadius?: number;
  fillOpacity?: number;
  /** Expand each stack to [0,1] (100% stacked). */
  expand?: boolean;
  /** Stagger layer grow when mode is bar + animate grow. */
  staggerLayers?: boolean;
}

/**
 * Stacked bar or stacked area from series.
 * SuperImg owns motion via `progress` — no d3-transition.
 */
export function stack(
  coords: CoordSystem,
  series: ChartSeries[],
  opts: StackChartOpts = {},
): string {
  if (series.length === 0) return "";
  const progress = opts.progress ?? 1;
  const mode = opts.mode ?? "bar";
  const areaBox = plotArea(coords, opts.padding ?? 8);
  const colors = chartColors(opts);
  const opacity = animOpacity(progress, opts.animate);
  const categories = series[0]!.data.map((d) => d.label);
  const keys = series.map((s) => s.id);

  // Wide table for d3.stack: { label, [key]: value }
  const rows = categories.map((cat) => {
    const row: Record<string, string | number> = { label: cat };
    for (const s of series) {
      const pt = s.data.find((d) => d.label === cat);
      row[s.id] = pt?.value ?? 0;
    }
    return row;
  });

  const stackGen = d3Stack<Record<string, string | number>, string>()
    .keys(keys)
    .value((d, key) => Number(d[key] ?? 0))
    .order(stackOrderNone)
    .offset(opts.expand ? stackOffsetExpand : stackOffsetNone);

  const stacked = stackGen(rows);

  // Domain from stacked extents
  let yMax = 0;
  let yMin = 0;
  for (const layer of stacked) {
    for (const pt of layer) {
      yMax = Math.max(yMax, pt[1]);
      yMin = Math.min(yMin, pt[0]);
    }
  }
  if (opts.expand) {
    yMin = 0;
    yMax = 1;
  }
  const yDomain = opts.yDomain ?? [yMin, yMax === yMin ? yMin + 1 : yMax];
  const y = linearScale(yDomain, [areaBox.top + areaBox.height, areaBox.top]);
  const x = bandScale(categories, [areaBox.left, areaBox.left + areaBox.width], 0.15);
  const bw = x.bandwidth();
  const grow = opts.animate === "grow" ? progress : 1;

  if (mode === "area") {
    return renderStackedArea(stacked, series, categories, x, y, bw, colors, {
      ...opts,
      progress,
      grow,
      opacity,
    });
  }

  return renderStackedBars(stacked, series, categories, x, y, bw, colors, {
    ...opts,
    progress,
    grow,
    opacity,
  });
}

function renderStackedBars(
  stacked: ReturnType<ReturnType<typeof d3Stack>>,
  series: ChartSeries[],
  categories: string[],
  x: ReturnType<typeof bandScale>,
  y: ReturnType<typeof linearScale>,
  bw: number,
  colors: string[],
  ctx: StackChartOpts & { grow: number; opacity: number },
): string {
  const r = ctx.barRadius ?? 2;
  const parts: string[] = [];
  const n = series.length;

  stacked.forEach((layer, si) => {
    const color = series[si]?.color ?? colors[si % colors.length]!;
    layer.forEach((pt, ci) => {
      const cat = categories[ci]!;
      const bx = x(cat) ?? 0;
      const staggered =
        ctx.animate === "grow" && ctx.staggerLayers
          ? Math.max(0, Math.min(1, ((ctx.progress ?? 1) * n - si) / 1))
          : ctx.grow;
      const y0 = pt[0] * staggered;
      const y1 = pt[1] * staggered;
      const yTop = y(y1)!;
      const yBot = y(y0)!;
      const h = Math.max(0, yBot - yTop);
      parts.push(
        `<rect x="${bx.toFixed(2)}" y="${yTop.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${color}" opacity="${ctx.opacity.toFixed(3)}"/>`,
      );
    });
  });

  return parts.join("\n");
}

function renderStackedArea(
  stacked: ReturnType<ReturnType<typeof d3Stack>>,
  series: ChartSeries[],
  categories: string[],
  x: ReturnType<typeof bandScale>,
  y: ReturnType<typeof linearScale>,
  bw: number,
  colors: string[],
  ctx: StackChartOpts & { grow: number; opacity: number },
): string {
  const fillOp = (ctx.fillOpacity ?? 0.85) * (ctx.animate === "fade" ? (ctx.progress ?? 1) : 1);
  const curve = resolveCurve(ctx.curve ?? "monotone", ctx.tension ?? 0.5);
  const parts: string[] = [];

  stacked.forEach((layer, si) => {
    const color = series[si]?.color ?? colors[si % colors.length]!;
    type Pt = { x: number; y0: number; y1: number };
    const pts: Pt[] = layer.map((pt, ci) => {
      const cat = categories[ci]!;
      const cx = (x(cat) ?? 0) + bw / 2;
      return {
        x: cx,
        y0: y(pt[0] * ctx.grow)!,
        y1: y(pt[1] * ctx.grow)!,
      };
    });

    const areaGen = d3Area<Pt>()
      .x((d) => d.x)
      .y0((d) => d.y0)
      .y1((d) => d.y1)
      .curve(curve);
    const d = areaGen(pts) ?? "";
    parts.push(`<path d="${d}" fill="${color}" opacity="${fillOp.toFixed(3)}"/>`);
  });

  return parts.join("\n");
}
