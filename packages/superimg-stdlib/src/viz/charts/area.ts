import type { CoordSystem } from "../coords.js";
import { bandScale } from "../scale.js";
import { makeArea, makeLine, type CurveName } from "../d3-helpers.js";
import type { ChartDataPoint, ChartOpts } from "./shared.js";
import { animOpacity, chartColors, chartScales, drawDashAttrs, plotArea } from "./shared.js";

export interface AreaChartOpts extends ChartOpts {
  curve?: CurveName;
  tension?: number;
  fillOpacity?: number;
  stroke?: boolean;
  strokeWidth?: number;
  defined?: (d: ChartDataPoint) => boolean;
}

/**
 * Area chart under a line — pure D3 geometry → SVG.
 * Drive reveal with `progress` + `animate: "grow" | "draw" | "fade"`.
 */
export function area(
  coords: CoordSystem,
  data: ChartDataPoint[],
  opts: AreaChartOpts = {},
): string {
  if (data.length === 0) return "";
  const progress = opts.progress ?? 1;
  const areaBox = plotArea(coords, opts.padding ?? 8);
  const scales = chartScales(coords, areaBox, opts);
  const color = chartColors(opts)[0]!;
  const grow = opts.animate === "grow" ? progress : 1;
  const definedFn = opts.defined ?? (() => true);
  const cats = data.map((d) => d.label);
  const xBand = bandScale(cats, [areaBox.left, areaBox.left + areaBox.width], 0.08);
  const bw = xBand.bandwidth();

  const points = data.map((d) => {
    const animatedValue = scales.yMin + (d.value - scales.yMin) * grow;
    return {
      datum: d,
      px: (xBand(d.label) ?? areaBox.left) + bw / 2,
      py: scales.y(animatedValue)!,
    };
  });

  const areaGen = makeArea<(typeof points)[number]>({
    x: (p) => p.px,
    y0: scales.baseline,
    y1: (p) => p.py,
    curve: opts.curve ?? "monotone",
    tension: opts.tension,
    defined: (p) => definedFn(p.datum),
  });
  const fillD = areaGen(points) ?? "";
  const fillOp = (opts.fillOpacity ?? 0.4) * (opts.animate === "fade" ? progress : opts.animate === "grow" ? progress : 1);
  const opacity = animOpacity(progress, opts.animate);

  const parts: string[] = [];

  if (opts.animate === "draw") {
    const clipW = areaBox.width * progress;
    const clipId = `area-clip-${Math.round(areaBox.left)}-${Math.round(areaBox.top)}`;
    parts.push(
      `<defs><clipPath id="${clipId}"><rect x="${areaBox.left}" y="${areaBox.top}" width="${clipW.toFixed(2)}" height="${areaBox.height}"/></clipPath></defs>`,
      `<path d="${fillD}" fill="${color}" opacity="${fillOp.toFixed(3)}" clip-path="url(#${clipId})"/>`,
    );
  } else {
    parts.push(`<path d="${fillD}" fill="${color}" opacity="${fillOp.toFixed(3)}"/>`);
  }

  if (opts.stroke !== false) {
    const lineGen = makeLine<(typeof points)[number]>({
      x: (p) => p.px,
      y: (p) => p.py,
      curve: opts.curve ?? "monotone",
      tension: opts.tension,
      defined: (p) => definedFn(p.datum),
    });
    const pathD = lineGen(points) ?? "";
    const sw = opts.strokeWidth ?? 2.5;
    if (opts.animate === "draw" && pathD) {
      const dash = drawDashAttrs(pathD, progress);
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash.strokeDasharray}" stroke-dashoffset="${dash.strokeDashoffset}" opacity="${opacity.toFixed(3)}"/>`,
      );
    } else {
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`,
      );
    }
  }

  return parts.join("\n");
}
