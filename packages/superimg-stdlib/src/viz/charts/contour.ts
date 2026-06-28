import { contours as d3Contours, contourDensity } from "d3-contour";
import type { CoordSystem } from "../coords.js";
import { linearScale } from "../scale.js";
import type { ChartOpts } from "./shared.js";
import { chartColors, plotArea } from "./shared.js";

export interface ContourOpts extends ChartOpts {
  padding?: number;
  strokeWidth?: number;
  fillOpacity?: number;
}

export interface DensityOpts extends ContourOpts {
  bandwidth?: number;
  thresholds?: number;
}

type MultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };

function contourPath(
  coords: CoordSystem,
  area: ReturnType<typeof plotArea>,
  geo: MultiPolygon,
  color: string,
  opts: ContourOpts,
): string {
  const [xMin, xMax] = coords.config.xRange;
  const [yMin, yMax] = coords.config.yRange;
  const x = linearScale([xMin, xMax], [area.left, area.left + area.width]);
  const y = linearScale([yMin, yMax], [area.top + area.height, area.top]);
  const sw = opts.strokeWidth ?? 1.5;
  const fillOp = (opts.fillOpacity ?? 0.5) * (opts.progress ?? 1);

  const parts: string[] = [];
  for (const poly of geo.coordinates) {
    for (const ring of poly) {
      const d = ring
        .map((pt, i) => {
          const px = x(pt[0]!)!.toFixed(2);
          const py = y(pt[1]!)!.toFixed(2);
          return `${i === 0 ? "M" : "L"} ${px} ${py}`;
        })
        .join(" ");
      parts.push(`${d} Z`);
    }
  }
  if (parts.length === 0) return "";
  return `<path d="${parts.join(" ")}" fill="${color}" fill-opacity="${fillOp.toFixed(3)}" stroke="${color}" stroke-width="${sw}" stroke-opacity="${(0.8 * (opts.progress ?? 1)).toFixed(3)}"/>`;
}

/** Isoline contours from a 2D value grid (row-major). */
export function contour(
  coords: CoordSystem,
  grid: number[][],
  thresholds?: number | number[],
  opts: ContourOpts = {},
): string {
  const area = plotArea(coords, opts.padding ?? 8);
  const flat = grid.flat();
  const [xMin, xMax] = coords.config.xRange;
  const [yMin, yMax] = coords.config.yRange;
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  if (cols === 0 || rows === 0) return "";

  const contourGen = d3Contours().size([cols, rows]);
  if (thresholds !== undefined) contourGen.thresholds(thresholds);
  const geoContours = contourGen(flat);

  const colors = chartColors(opts);
  const progress = opts.progress ?? 1;
  const visible = Math.max(1, Math.floor(geoContours.length * progress));

  return geoContours
    .slice(0, visible)
    .map((c, i) => {
      const scaled: MultiPolygon = {
        type: "MultiPolygon",
        coordinates: c.coordinates.map((poly) =>
          poly.map((ring) =>
            ring.map(([col, row]) => [
              xMin + (col / Math.max(cols - 1, 1)) * (xMax - xMin),
              yMin + (row / Math.max(rows - 1, 1)) * (yMax - yMin),
            ]),
          ),
        ),
      };
      return contourPath(coords, area, scaled, colors[i % colors.length]!, opts);
    })
    .join("\n");
}

/** 2D kernel density contours from scattered points. */
export function density(
  coords: CoordSystem,
  points: Array<{ x: number; y: number }>,
  opts: DensityOpts = {},
): string {
  if (points.length === 0) return "";
  const area = plotArea(coords, opts.padding ?? 8);
  const [xMin, xMax] = coords.config.xRange;
  const [yMin, yMax] = coords.config.yRange;
  const colors = chartColors(opts);
  const progress = opts.progress ?? 1;

  const x = linearScale([xMin, xMax], [0, area.width]);
  const y = linearScale([yMin, yMax], [area.height, 0]);
  const data = points.map((p) => [x(p.x)!, y(p.y)!] as [number, number]);

  const densityGen = contourDensity()
    .x((d) => d[0])
    .y((d) => d[1])
    .size([area.width, area.height]);
  if (opts.bandwidth !== undefined) densityGen.bandwidth(opts.bandwidth);
  if (opts.thresholds !== undefined) densityGen.thresholds(opts.thresholds);

  const geoContours = densityGen(data);
  const visible = Math.max(1, Math.floor(geoContours.length * progress));

  return geoContours
    .slice(0, visible)
    .map((c, i) => {
      const parts: string[] = [];
      for (const poly of c.coordinates) {
        for (const ring of poly) {
          const d = ring
            .map((pt, j) => {
              const px = (area.left + pt[0]!).toFixed(2);
              const py = (area.top + pt[1]!).toFixed(2);
              return `${j === 0 ? "M" : "L"} ${px} ${py}`;
            })
            .join(" ");
          parts.push(`${d} Z`);
        }
      }
      const color = colors[i % colors.length]!;
      const fillOp = (opts.fillOpacity ?? 0.45) * progress;
      return `<path d="${parts.join(" ")}" fill="${color}" fill-opacity="${fillOp.toFixed(3)}" stroke="${color}" stroke-width="${opts.strokeWidth ?? 1}" stroke-opacity="${(0.6 * progress).toFixed(3)}"/>`;
    })
    .join("\n");
}