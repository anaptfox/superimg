import { arc as d3Arc, pie as d3Pie } from "d3-shape";
import type { Box } from "../../layout.js";
import type { ChartDataPoint, ChartOpts } from "./shared.js";
import { chartColors } from "./shared.js";

export interface PieLabelOpts {
  format?: "percent" | "name" | "both";
  fontSize?: number;
  fontFamily?: string;
  minAngle?: number;
}

export interface PieOpts extends ChartOpts {
  innerRadius?: number;
  outerRadius?: number;
  cx?: number;
  cy?: number;
  box?: Box;
  labels?: boolean | PieLabelOpts;
}

function labelText(
  d: ChartDataPoint,
  pct: number,
  format: PieLabelOpts["format"],
): string {
  if (format === "percent") return `${pct}%`;
  if (format === "name") return d.label;
  return `${d.label} ${pct}%`;
}

export function pie(data: ChartDataPoint[], opts: PieOpts = {}): string {
  const progress = opts.progress ?? 1;
  const cx = opts.box ? opts.box.x + opts.box.width / 2 : (opts.cx ?? 0);
  const cy = opts.box ? opts.box.y + opts.box.height / 2 : (opts.cy ?? 0);
  const outer = opts.outerRadius ?? (opts.box ? Math.min(opts.box.width, opts.box.height) * 0.4 : 120);
  const inner = opts.innerRadius ?? 0;
  const colors = chartColors(opts);
  const pieGen = d3Pie<ChartDataPoint>().value((d) => d.value).sort(null);
  const arcGen = d3Arc<unknown>().innerRadius(inner).outerRadius(outer);
  const labelArc = d3Arc<unknown>().innerRadius(outer * 0.55).outerRadius(outer * 0.85);

  const labelOpts: PieLabelOpts | null =
    opts.labels === true
      ? { format: "both", fontSize: 14, fontFamily: "Inter,sans-serif", minAngle: 0.15 }
      : opts.labels
        ? {
            format: "both",
            fontSize: 14,
            fontFamily: "Inter,sans-serif",
            minAngle: 0.15,
            ...opts.labels,
          }
        : null;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const slices = pieGen(data);

  return slices
    .map((s, i) => {
      const span = s.endAngle - s.startAngle;
      const animated = {
        ...s,
        endAngle: s.startAngle + span * progress,
      };
      const d = arcGen(animated) ?? "";
      const color = colors[i % colors.length]!;
      const pct = Math.round((s.data.value / total) * 100);

      let labelEl = "";
      if (labelOpts && span * progress >= (labelOpts.minAngle ?? 0)) {
        const [lx, ly] = labelArc.centroid(animated) ?? [0, 0];
        const text = labelText(s.data, pct, labelOpts.format ?? "both");
        labelEl = `<text x="${(cx + lx).toFixed(1)}" y="${(cy + ly).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="${labelOpts.fontFamily ?? "Inter,sans-serif"}" font-size="${labelOpts.fontSize ?? 14}" font-weight="600" fill="#f0f4ff">${text}</text>`;
      }

      return `<path d="${d}" transform="translate(${cx},${cy})" fill="${color}" opacity="0.9"/>${labelEl}`;
    })
    .join("\n");
}