import type { GradientStop } from "../color/gradient.js";
import { animateGradientStops } from "../color/gradient.js";
import { colord } from "colord";

let uid = 0;

export interface SvgGradientResult {
  id: string;
  defs: string;
  fill: string;
}

export interface SvgLinearGradientOpts {
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
  /** Shorthand: angle in degrees maps to x1/y1/x2/y2 */
  angle?: number;
}

export interface SvgRadialGradientOpts {
  cx?: string;
  cy?: string;
  r?: string;
}

function stopEls(stops: GradientStop[]): string {
  return stops
    .map((s) => {
      const offset =
        typeof s.offset === "number"
          ? `${Math.round(s.offset * 1000) / 10}%`
          : s.offset;
      const color = colord(s.color).toRgbString();
      return `<stop offset="${offset}" stop-color="${color}"/>`;
    })
    .join("");
}

function angleToCoords(angle: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = `${50 - Math.cos(rad) * 50}%`;
  const y1 = `${50 - Math.sin(rad) * 50}%`;
  const x2 = `${50 + Math.cos(rad) * 50}%`;
  const y2 = `${50 + Math.sin(rad) * 50}%`;
  return { x1, y1, x2, y2 };
}

export function linear(stops: GradientStop[], opts: SvgLinearGradientOpts = {}): SvgGradientResult {
  const id = `grad-lin-${uid++}`;
  const coords = opts.angle != null ? angleToCoords(opts.angle) : { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
  const x1 = opts.x1 ?? coords.x1;
  const y1 = opts.y1 ?? coords.y1;
  const x2 = opts.x2 ?? coords.x2;
  const y2 = opts.y2 ?? coords.y2;
  const defs = `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopEls(stops)}</linearGradient>`;
  return { id, defs, fill: `url(#${id})` };
}

export function radial(stops: GradientStop[], opts: SvgRadialGradientOpts = {}): SvgGradientResult {
  const id = `grad-rad-${uid++}`;
  const cx = opts.cx ?? "50%";
  const cy = opts.cy ?? "50%";
  const r = opts.r ?? "50%";
  const defs = `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopEls(stops)}</radialGradient>`;
  return { id, defs, fill: `url(#${id})` };
}

export function animate(
  stopsA: GradientStop[],
  stopsB: GradientStop[],
  progress: number,
  kind: "linear" | "radial" = "linear",
  opts?: SvgLinearGradientOpts | SvgRadialGradientOpts,
): SvgGradientResult {
  const morphed = animateGradientStops(stopsA, stopsB, progress);
  return kind === "radial"
    ? radial(morphed, opts as SvgRadialGradientOpts)
    : linear(morphed, opts as SvgLinearGradientOpts);
}