import { treemap as d3Treemap, pack as d3Pack, partition as d3Partition } from "d3-hierarchy";
import { arc as d3Arc } from "d3-shape";
import type { Box } from "../../layout.js";
import type { ChartOpts } from "./shared.js";
import { chartColors } from "./shared.js";
import { hierarchyRoot } from "../d3-helpers.js";

export interface HierarchyDatum {
  label: string;
  value: number;
  children?: HierarchyDatum[];
}

export interface HierarchyOpts extends ChartOpts {
  padding?: number;
  showLabels?: boolean;
  labelFontSize?: number;
  labelColor?: string;
  stroke?: string;
  strokeWidth?: number;
}

function wrapRoot(data: HierarchyDatum) {
  return hierarchyRoot(
    { label: "root", value: 0, children: data.children ?? [data] },
    (d) => d.value,
  );
}

export function treemap(box: Box, data: HierarchyDatum | HierarchyDatum[], opts: HierarchyOpts = {}): string {
  const progress = opts.progress ?? 1;
  const pad = opts.padding ?? 2;
  const colors = chartColors(opts);
  const stroke = opts.stroke ?? "rgba(255,255,255,0.08)";
  const sw = opts.strokeWidth ?? 1;
  const labelSize = opts.labelFontSize ?? 12;
  const labelColor = opts.labelColor ?? "#e2e8f0";

  const items = Array.isArray(data) ? { label: "root", value: 0, children: data } : data;
  const root = wrapRoot(items);
  d3Treemap<HierarchyDatum>().size([box.width, box.height]).padding(pad)(root);

  return root
    .leaves()
    .map((node, i) => {
      const w = (node.x1! - node.x0!) * progress;
      const h = (node.y1! - node.y0!) * progress;
      const x = box.x + node.x0!;
      const y = box.y + node.y0!;
      const color = colors[i % colors.length]!;
      let label = "";
      if (opts.showLabels && w > 28 && h > 16) {
        label = `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}" opacity="${progress.toFixed(3)}">${node.data.label}</text>`;
      }
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" opacity="${(0.85 * progress).toFixed(3)}"/>${label}`;
    })
    .join("\n");
}

export function pack(box: Box, data: HierarchyDatum | HierarchyDatum[], opts: HierarchyOpts = {}): string {
  const progress = opts.progress ?? 1;
  const colors = chartColors(opts);
  const stroke = opts.stroke ?? "rgba(255,255,255,0.12)";
  const sw = opts.strokeWidth ?? 1;
  const labelSize = opts.labelFontSize ?? 11;
  const labelColor = opts.labelColor ?? "#e2e8f0";

  const items = Array.isArray(data) ? { label: "root", value: 0, children: data } : data;
  const root = wrapRoot(items);
  d3Pack<HierarchyDatum>().size([box.width, box.height]).padding(opts.padding ?? 3)(root);

  return root
    .descendants()
    .filter((d) => d.depth > 0)
    .map((node, i) => {
      const r = (node.r ?? 0) * progress;
      const cx = box.x + (node.x ?? 0);
      const cy = box.y + (node.y ?? 0);
      const color = colors[i % colors.length]!;
      let label = "";
      if (opts.showLabels && r > 14) {
        label = `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}" opacity="${progress.toFixed(3)}">${node.data.label}</text>`;
      }
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" opacity="${(0.85 * progress).toFixed(3)}"/>${label}`;
    })
    .join("\n");
}

export function sunburst(box: Box, data: HierarchyDatum | HierarchyDatum[], opts: HierarchyOpts = {}): string {
  const progress = opts.progress ?? 1;
  const colors = chartColors(opts);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) / 2;
  const labelSize = opts.labelFontSize ?? 11;
  const labelColor = opts.labelColor ?? "#e2e8f0";

  const items = Array.isArray(data) ? { label: "root", value: 0, children: data } : data;
  const root = wrapRoot(items);
  d3Partition<HierarchyDatum>().size([2 * Math.PI, radius])(root);

  const arcGen = d3Arc<typeof root>()
    .startAngle((d) => d.x0!)
    .endAngle((d) => d.x0! + (d.x1! - d.x0!) * progress)
    .innerRadius((d) => d.y0!)
    .outerRadius((d) => d.y1!);

  const labelArc = d3Arc<typeof root>()
    .startAngle((d) => (d.x0! + d.x1!) / 2)
    .endAngle((d) => (d.x0! + d.x1!) / 2)
    .innerRadius((d) => (d.y0! + d.y1!) / 2)
    .outerRadius((d) => (d.y0! + d.y1!) / 2);

  return root
    .descendants()
    .filter((d) => d.depth > 0)
    .map((node, i) => {
      const d = arcGen(node) ?? "";
      const color = colors[i % colors.length]!;
      const span = node.x1! - node.x0!;
      let label = "";
      if (opts.showLabels && span * progress > 0.12) {
        const [lx, ly] = labelArc.centroid(node) ?? [0, 0];
        label = `<text x="${(cx + lx).toFixed(1)}" y="${(cy + ly).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif" font-size="${labelSize}" fill="${labelColor}" opacity="${progress.toFixed(3)}">${node.data.label}</text>`;
      }
      return `<path d="${d}" transform="translate(${cx},${cy})" fill="${color}" stroke="#06060f" stroke-width="0.5" opacity="${(0.9 * progress).toFixed(3)}"/>${label}`;
    })
    .join("\n");
}