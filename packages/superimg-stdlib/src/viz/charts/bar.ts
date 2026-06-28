import type { CoordSystem } from "../coords.js";
import { bandScale } from "../scale.js";
import type { ChartDataPoint, ChartOpts } from "./shared.js";
import { animOpacity, chartColors, chartScales, plotArea } from "./shared.js";

export interface BarChartOpts extends ChartOpts {
  barRadius?: number;
  showLabels?: boolean;
  showValueLabels?: boolean;
  labelFontSize?: number;
  labelColor?: string;
  valueLabelFontSize?: number;
}

export function bar(
  coords: CoordSystem,
  data: ChartDataPoint[],
  opts: BarChartOpts = {},
): string {
  const progress = opts.progress ?? 1;
  const area = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, area, opts);
  const labels = data.map((d) => d.label);
  const x = bandScale(labels, [area.left, area.left + area.width], 0.15);
  const colors = chartColors(opts);
  const opacity = animOpacity(progress, opts.animate);
  const bw = x.bandwidth();
  const labelSize = opts.labelFontSize ?? 12;
  const labelColor = opts.labelColor ?? "#6b7795";
  const valueLabelSize = opts.valueLabelFontSize ?? 11;

  const parts: string[] = [];

  data.forEach((d, i) => {
    const bx = x(d.label) ?? area.left;
    const grow = opts.animate === "grow" ? progress : 1;
    const animatedVal = scales.yMin + (d.value - scales.yMin) * grow;
    const yTop = scales.y(animatedVal)!;
    const h = scales.baseline - yTop;
    const color = colors[i % colors.length]!;
    const r = opts.barRadius ?? 4;
    parts.push(
      `<rect x="${bx.toFixed(2)}" y="${yTop.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`,
    );
    if (opts.showValueLabels && h > valueLabelSize + 4) {
      const cx = bx + bw / 2;
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${(yTop + 4 + valueLabelSize).toFixed(2)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${valueLabelSize}" font-weight="600" fill="#f0f4ff" opacity="${opacity.toFixed(3)}">${d.value}</text>`,
      );
    }
    if (opts.showLabels) {
      const cx = bx + bw / 2;
      const ly = area.top + area.height + labelSize + 4;
      parts.push(
        `<text x="${cx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}" opacity="${opacity.toFixed(3)}">${d.label}</text>`,
      );
    }
  });

  return parts.join("\n");
}