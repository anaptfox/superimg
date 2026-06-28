import { max, min, extent } from "d3-array";
import { format as d3Format } from "d3-format";
import {
  line as d3Line,
  area as d3Area,
  curveLinear,
  curveMonotoneX,
  curveCatmullRom,
  curveStep,
  type CurveFactory,
  type Line,
  type Area,
} from "d3-shape";
import { hierarchy as d3Hierarchy, type HierarchyNode } from "d3-hierarchy";
import type { ChartDataPoint } from "./charts/shared.js";

export type CurveName = "linear" | "monotone" | "catmullRom" | "step";

export function resolveCurve(name: CurveName = "monotone", tension = 0.5): CurveFactory {
  switch (name) {
    case "linear":
      return curveLinear;
    case "catmullRom":
      return curveCatmullRom.alpha(tension);
    case "step":
      return curveStep;
    default:
      return curveMonotoneX;
  }
}

export interface LineGenOpts<T> {
  x: (d: T, i: number) => number;
  y: (d: T, i: number) => number;
  curve?: CurveName;
  tension?: number;
  defined?: (d: T, i: number) => boolean;
}

export function makeLine<T>(opts: LineGenOpts<T>): Line<T> {
  const gen = d3Line<T>()
    .x(opts.x)
    .y(opts.y)
    .curve(resolveCurve(opts.curve, opts.tension));
  if (opts.defined) gen.defined(opts.defined);
  return gen;
}

export interface AreaGenOpts<T> {
  x: (d: T, i: number) => number;
  y0: number;
  y1: (d: T, i: number) => number;
  curve?: CurveName;
  tension?: number;
  defined?: (d: T, i: number) => boolean;
}

export function makeArea<T>(opts: AreaGenOpts<T>): Area<T> {
  const gen = d3Area<T>()
    .x(opts.x)
    .y0(opts.y0)
    .y1(opts.y1)
    .curve(resolveCurve(opts.curve, opts.tension));
  if (opts.defined) gen.defined(opts.defined);
  return gen;
}

export function defaultTickFormatter(precision = 2): (v: number) => string {
  const fmt = d3Format(`.${precision}f`);
  const si = d3Format(".2s");
  return (v: number) => {
    const a = Math.abs(v);
    if (a >= 1000 || (a > 0 && a < 0.01)) return si(v);
    return fmt(v);
  };
}

export function hierarchyRoot<T extends { children?: T[] }>(
  data: T,
  value: (d: T) => number,
): HierarchyNode<T> {
  return d3Hierarchy(data).sum(value).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

export { max, min, extent };