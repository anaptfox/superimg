import {
  scaleBand,
  scaleLinear,
  scaleTime,
  scaleOrdinal,
  scaleLog,
  scalePoint,
  scaleSequential,
} from "d3-scale";
import { interpolateRgb } from "d3-interpolate";

export function bandScale(domain: string[], range: [number, number], padding = 0.1) {
  return scaleBand().domain(domain).range(range).padding(padding);
}

export function linearScale(domain: [number, number], range: [number, number]) {
  return scaleLinear().domain(domain).range(range);
}

export function timeScale(domain: [Date, Date], range: [number, number]) {
  return scaleTime().domain(domain).range(range);
}

export function colorScale(domain: string[], colors: string[]) {
  return scaleOrdinal<string, string>().domain(domain).range(colors);
}

/** Log scale — domain values must be > 0. */
export function logScale(domain: [number, number], range: [number, number], base = 10) {
  return scaleLog().base(base).domain(domain).range(range);
}

/** Point scale for discrete categories without band width (centered). */
export function pointScale(domain: string[], range: [number, number], padding = 0.5) {
  return scalePoint().domain(domain).range(range).padding(padding);
}

/**
 * Sequential color scale from domain [min,max] → color interpolator.
 * Default interpolator: blue→purple brand ramp.
 */
export function sequentialScale(
  domain: [number, number],
  interpolator: (t: number) => string = interpolateRgb("#5b8cff", "#f093fb"),
) {
  return scaleSequential(interpolator).domain(domain);
}