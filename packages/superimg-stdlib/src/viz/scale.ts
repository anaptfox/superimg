import { scaleBand, scaleLinear, scaleTime, scaleOrdinal } from "d3-scale";

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