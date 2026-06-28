import type { CoordSystem } from "../coords.js";
import type { ChartSeries } from "./shared.js";
import type { LineChartOpts } from "./line.js";
import { line } from "./line.js";

export interface MultiLineOpts extends LineChartOpts {
  stagger?: boolean;
}

export function lines(
  coords: CoordSystem,
  series: ChartSeries[],
  opts: MultiLineOpts = {},
): string {
  const n = series.length || 1;
  return series
    .map((s, i) => {
      const staggered = opts.stagger
        ? Math.max(0, Math.min(1, ((opts.progress ?? 1) * n - i) / 1))
        : (opts.progress ?? 1);
      const color = s.color;
      return line(coords, s.data, {
        ...opts,
        progress: staggered,
        colors: color ? [color] : opts.colors,
      });
    })
    .join("\n");
}