import type { CoordSystem } from "../coords.js";
import { bandScale } from "../scale.js";
import type { ChartDataPoint } from "./shared.js";
import type { BarChartOpts } from "./bar.js";
import { animOpacity, chartColors, chartScales, plotArea } from "./shared.js";

export interface BarHorizontalOpts extends BarChartOpts {
  labelSide?: "left" | "right";
}

export function barHorizontal(
  coords: CoordSystem,
  data: ChartDataPoint[],
  opts: BarHorizontalOpts = {},
): string {
  const progress = opts.progress ?? 1;
  const area = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, area, opts);
  const labels = data.map((d) => d.label);
  const y = bandScale(labels, [area.top, area.top + area.height], 0.15);
  const colors = chartColors(opts);
  const opacity = animOpacity(progress, opts.animate);
  const bh = y.bandwidth();
  const labelSize = opts.labelFontSize ?? 12;
  const labelColor = opts.labelColor ?? "#6b7795";
  const xOrigin = scales.x(scales.xMin)!;
  const parts: string[] = [];

  data.forEach((d, i) => {
    const by = y(d.label) ?? area.top;
    const grow = opts.animate === "grow" ? progress : 1;
    const animatedVal = scales.xMin + (d.value - scales.xMin) * grow;
    const xEnd = scales.x(animatedVal)!;
    const w = xEnd - xOrigin;
    const color = colors[i % colors.length]!;
    const r = opts.barRadius ?? 4;
    parts.push(
      `<rect x="${xOrigin.toFixed(2)}" y="${by.toFixed(2)}" width="${w.toFixed(2)}" height="${bh.toFixed(2)}" rx="${r}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`,
    );
    if (opts.showLabels) {
      const labelX =
        opts.labelSide === "right"
          ? area.left + area.width + 8
          : area.left - 8;
      const anchor = opts.labelSide === "right" ? "start" : "end";
      const ly = by + bh / 2 + labelSize * 0.35;
      parts.push(
        `<text x="${labelX.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}" opacity="${opacity.toFixed(3)}">${d.label}</text>`,
      );
    }
    if (opts.showValueLabels && w > 28) {
      parts.push(
        `<text x="${(xEnd - 6).toFixed(2)}" y="${(by + bh / 2 + 4).toFixed(2)}" text-anchor="end" font-family="Inter,sans-serif" font-size="${opts.valueLabelFontSize ?? 11}" font-weight="600" fill="#f0f4ff" opacity="${opacity.toFixed(3)}">${d.value}</text>`,
      );
    }
  });

  return parts.join("\n");
}