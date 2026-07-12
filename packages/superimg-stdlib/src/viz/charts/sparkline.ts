import type { Box } from "../../layout.js";
import { extent } from "../d3-helpers.js";
import { makeLine, makeArea, type CurveName } from "../d3-helpers.js";
import { animOpacity, drawDashAttrs } from "./shared.js";

export interface SparklineOpts {
  color?: string;
  progress?: number;
  animate?: "draw" | "fade" | "grow";
  fill?: boolean;
  strokeWidth?: number;
  showDot?: boolean;
  curve?: CurveName;
}

interface SparkPt {
  px: number;
  py: number;
}

export function sparkline(box: Box, values: number[], opts: SparklineOpts = {}): string {
  if (values.length === 0) return "";
  const progress = opts.progress ?? 1;
  const color = opts.color ?? "#5b8cff";
  const sw = opts.strokeWidth ?? 2.5;
  const opacity = animOpacity(progress, opts.animate);
  const grow = opts.animate === "grow" ? progress : 1;
  const curve = opts.curve ?? "monotone";

  const [min = 0, max = 1] = extent(values) ?? [0, 1];
  const range = Math.max(max - min, 1);

  const points: SparkPt[] = values.map((v, i) => {
    const normalized = min + (v - min) * grow;
    return {
      px: box.x + (i / Math.max(values.length - 1, 1)) * box.width,
      py: box.y + box.height - ((normalized - min) / range) * box.height,
    };
  });

  const lineGen = makeLine<SparkPt>({ x: (p) => p.px, y: (p) => p.py, curve });
  const d = lineGen(points) ?? "";
  const parts: string[] = [];
  const baseY = box.y + box.height;

  if (opts.fill && d) {
    const areaGen = makeArea<SparkPt>({ x: (p) => p.px, y0: baseY, y1: (p) => p.py, curve });
    const areaD = areaGen(points) ?? "";
    const fillOp = opts.animate === "draw" ? opacity * 0.35 : 0.2 * grow;
    if (opts.animate === "draw") {
      // Deterministic id (avoid Math.random — parallel/export stable)
      const clipId = `spark-fill-${box.x | 0}-${box.y | 0}-${box.width | 0}-${values.length}`;
      parts.push(
        `<defs><clipPath id="${clipId}"><rect x="${box.x}" y="${box.y}" width="${(box.width * progress).toFixed(1)}" height="${box.height}"/></clipPath></defs>`,
        `<path d="${areaD}" fill="${color}" opacity="${fillOp.toFixed(3)}" clip-path="url(#${clipId})"/>`,
      );
    } else {
      parts.push(`<path d="${areaD}" fill="${color}" opacity="${fillOp.toFixed(3)}"/>`);
    }
  }

  if (opts.animate === "draw" && d) {
    const dash = drawDashAttrs(d, progress);
    parts.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash.strokeDasharray}" stroke-dashoffset="${dash.strokeDashoffset}" opacity="${opacity.toFixed(3)}"/>`,
    );
  } else if (d) {
    parts.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`,
    );
  }

  if (opts.showDot !== false && progress > 0.85) {
    const dotP = Math.min(1, (progress - 0.85) / 0.15);
    const last = points[points.length - 1]!;
    parts.push(
      `<circle cx="${last.px.toFixed(1)}" cy="${last.py.toFixed(1)}" r="${(3 * dotP).toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`,
    );
  }

  return parts.join("\n");
}