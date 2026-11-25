import type { CoordSystem } from "../coords.js";
import { bandScale } from "../scale.js";
import type { ChartSeries } from "./shared.js";
import type { BarChartOpts } from "./bar.js";
import { baselineValue, animOpacity, chartColors, seriesCategories, chartScales, plotArea } from "./shared.js";

export interface GroupedBarOpts extends BarChartOpts {
  groupPadding?: number;
  stagger?: boolean;
}

export function bars(
  coords: CoordSystem,
  series: ChartSeries[],
  opts: GroupedBarOpts = {},
): string {
  if (series.length === 0) return "";
  const progress = opts.progress ?? 1;
  const area = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, area, opts);
  const categories = seriesCategories(series);
  const x = bandScale(categories, [area.left, area.left + area.width], 0.2);
  const groupBw = x.bandwidth();
  const n = series.length;
  const innerPad = opts.groupPadding ?? 0.08;
  const barW = (groupBw / n) * (1 - innerPad);
  const gap = (groupBw * innerPad) / (n + 1);
  const colors = chartColors(opts);
  const opacity = animOpacity(progress, opts.animate);
  const r = opts.barRadius ?? 3;
  const parts: string[] = [];

  categories.forEach((cat) => {
    const gx = x(cat) ?? area.left;
    series.forEach((s, si) => {
      const pt = s.data.find((d) => d.label === cat);
      if (!pt || !Number.isFinite(pt.value)) return;
      const staggered = opts.stagger
        ? Math.max(0, Math.min(1, (progress * n - si) / 1))
        : progress;
      const grow = opts.animate === "grow" ? staggered : 1;
      const animatedVal = baselineValue(scales.yMin, scales.yMax) + (pt.value - baselineValue(scales.yMin, scales.yMax)) * grow;
      const yEnd = scales.y(animatedVal)!;
      const yTop = Math.min(scales.baseline, yEnd);
      const h = Math.abs(scales.baseline - yEnd);
      const bx = gx + gap + si * (barW + gap);
      const color = s.color ?? colors[si % colors.length]!;
      parts.push(
        `<rect x="${bx.toFixed(2)}" y="${yTop.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`,
      );
    });
  });

  return parts.join("\n");
}