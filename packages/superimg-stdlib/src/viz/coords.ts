import { scaleLinear } from "d3-scale";
import { defaultTickFormatter } from "./d3-helpers.js";

export interface CoordConfig {
  xRange?: [number, number];
  yRange?: [number, number];
  width: number;
  height: number;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
}

interface ResolvedPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CoordSystem {
  toPixel(x: number, y: number): { px: number; py: number };
  toMath(px: number, py: number): { x: number; y: number };
  width: number;
  height: number;
  config: Required<CoordConfig> & { padding: ResolvedPadding };
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
}

function resolvePadding(padding: CoordConfig["padding"]): ResolvedPadding {
  const def = 40;
  if (padding == null) return { top: def, right: def, bottom: def, left: def };
  if (typeof padding === "number") return { top: padding, right: padding, bottom: padding, left: padding };
  return {
    top: padding.top ?? def,
    right: padding.right ?? def,
    bottom: padding.bottom ?? def,
    left: padding.left ?? def,
  };
}

export function createCoords(config: CoordConfig): CoordSystem {
  const xRange: [number, number] = config.xRange ?? [-5, 5];
  const yRange: [number, number] = config.yRange ?? [-5, 5];
  const pad = resolvePadding(config.padding);
  const { width, height } = config;

  const plotLeft = pad.left;
  const plotTop = pad.top;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;

  function toPixel(x: number, y: number) {
    const px = plotLeft + ((x - xMin) / xSpan) * plotWidth;
    const py = plotTop + ((yMax - y) / ySpan) * plotHeight;
    return { px, py };
  }

  function toMath(px: number, py: number) {
    const x = xMin + ((px - plotLeft) / plotWidth) * xSpan;
    const y = yMax - ((py - plotTop) / plotHeight) * ySpan;
    return { x, y };
  }

  return {
    toPixel,
    toMath,
    width,
    height,
    config: { xRange, yRange, width, height, padding: pad },
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
  };
}

function pixelScales(coords: CoordSystem) {
  const { xRange, yRange } = coords.config;
  const { px: x0 } = coords.toPixel(xRange[0], 0);
  const { px: x1 } = coords.toPixel(xRange[1], 0);
  const { py: y0 } = coords.toPixel(0, yRange[0]);
  const { py: y1 } = coords.toPixel(0, yRange[1]);
  const xScale = scaleLinear().domain(xRange).range([x0, x1]);
  const yScale = scaleLinear().domain(yRange).range([y0, y1]);
  return { xScale, yScale };
}

export interface AxesOptions {
  color?: string;
  strokeWidth?: number;
  ticks?: number;
  tickLength?: number;
  labels?: boolean;
  fontSize?: number;
  progress?: number;
  tickFormat?: (v: number) => string;
}

export function axes(coords: CoordSystem, opts: AxesOptions = {}): string {
  const {
    color = "#888",
    strokeWidth = 1.5,
    ticks = 6,
    tickLength = 5,
    labels = true,
    fontSize = 12,
    progress = 1,
    tickFormat = defaultTickFormatter(),
  } = opts;

  const { xRange, yRange } = coords.config;
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const { xScale, yScale } = pixelScales(coords);

  const originX = Math.max(xMin, Math.min(xMax, 0));
  const originY = Math.max(yMin, Math.min(yMax, 0));

  const { px: oxPx } = coords.toPixel(originX, 0);
  const { py: oyPy } = coords.toPixel(0, originY);

  const { px: xStartPx } = coords.toPixel(xMin, 0);
  const { px: xEndPx } = coords.toPixel(xMax, 0);
  const xLen = xEndPx - xStartPx;

  const { py: yStartPy } = coords.toPixel(0, yMax);
  const { py: yEndPy } = coords.toPixel(0, yMin);
  const yLen = yEndPy - yStartPy;

  const dashX = progress < 1 ? `stroke-dasharray="${xLen}" stroke-dashoffset="${xLen * (1 - progress)}"` : "";
  const dashY = progress < 1 ? `stroke-dasharray="${yLen}" stroke-dashoffset="${yLen * (1 - progress)}"` : "";

  const lines: string[] = [
    `<line x1="${xStartPx}" y1="${oyPy}" x2="${xEndPx}" y2="${oyPy}" stroke="${color}" stroke-width="${strokeWidth}" ${dashX}/>`,
    `<line x1="${oxPx}" y1="${yStartPy}" x2="${oxPx}" y2="${yEndPy}" stroke="${color}" stroke-width="${strokeWidth}" ${dashY}/>`,
  ];

  const tickEls: string[] = [];
  for (const v of xScale.ticks(ticks)) {
    if (Math.abs(v) < 1e-9) continue;
    const { px } = coords.toPixel(v, 0);
    tickEls.push(
      `<line x1="${px}" y1="${oyPy - tickLength}" x2="${px}" y2="${oyPy + tickLength}" stroke="${color}" stroke-width="${strokeWidth * 0.8}"/>`,
    );
    if (labels) {
      tickEls.push(
        `<text x="${px}" y="${oyPy + tickLength + fontSize + 2}" text-anchor="middle" fill="${color}" font-size="${fontSize}" font-family="monospace" opacity="${progress}">${tickFormat(v)}</text>`,
      );
    }
  }

  for (const v of yScale.ticks(ticks)) {
    if (Math.abs(v) < 1e-9) continue;
    const { py } = coords.toPixel(0, v);
    tickEls.push(
      `<line x1="${oxPx - tickLength}" y1="${py}" x2="${oxPx + tickLength}" y2="${py}" stroke="${color}" stroke-width="${strokeWidth * 0.8}"/>`,
    );
    if (labels) {
      tickEls.push(
        `<text x="${oxPx - tickLength - 4}" y="${py + fontSize * 0.35}" text-anchor="end" fill="${color}" font-size="${fontSize}" font-family="monospace" opacity="${progress}">${tickFormat(v)}</text>`,
      );
    }
  }

  return `<g>${lines.join("")}${tickEls.join("")}</g>`;
}

export interface GridOptions {
  color?: string;
  strokeWidth?: number;
  ticks?: number;
  progress?: number;
}

export function grid(coords: CoordSystem, opts: GridOptions = {}): string {
  const { color = "#222", strokeWidth = 0.5, ticks = 6, progress = 1 } = opts;
  const { xRange, yRange } = coords.config;
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const { xScale, yScale } = pixelScales(coords);

  const paths: string[] = [];

  for (const v of xScale.ticks(ticks)) {
    const { px } = coords.toPixel(v, 0);
    const { py: py1 } = coords.toPixel(0, yMax);
    const { py: py2 } = coords.toPixel(0, yMin);
    paths.push(`M ${px} ${py1} L ${px} ${py2}`);
  }

  for (const v of yScale.ticks(ticks)) {
    const { py } = coords.toPixel(0, v);
    const { px: px1 } = coords.toPixel(xMin, 0);
    const { px: px2 } = coords.toPixel(xMax, 0);
    paths.push(`M ${px1} ${py} L ${px2} ${py}`);
  }

  return `<path d="${paths.join(" ")}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="${progress}"/>`;
}

export interface NumberLineOptions {
  x1: number; y1: number; x2: number; y2: number;
  min: number; max: number; step?: number;
  color?: string; strokeWidth?: number;
  labels?: boolean; fontSize?: number;
  progress?: number;
}

export function numberLine(opts: NumberLineOptions): string {
  const {
    x1, y1, x2, y2,
    min, max, step = 1,
    color = "#888", strokeWidth = 1.5,
    labels = true, fontSize = 12,
    progress = 1,
  } = opts;

  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const dash = progress < 1 ? `stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - progress)}"` : "";

  const dx = (x2 - x1) / (max - min);
  const dy = (y2 - y1) / (max - min);

  const ticks: string[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + 1e-9; v += step) {
    const t = (v - min) / (max - min);
    const tx = x1 + t * (x2 - x1);
    const ty = y1 + t * (y2 - y1);
    const nx = -dy / Math.sqrt(dx * dx + dy * dy) * 5;
    const ny = dx / Math.sqrt(dx * dx + dy * dy) * 5;
    ticks.push(`<line x1="${tx - nx}" y1="${ty - ny}" x2="${tx + nx}" y2="${ty + ny}" stroke="${color}" stroke-width="${strokeWidth * 0.8}" opacity="${progress}"/>`);
    if (labels) {
      ticks.push(`<text x="${tx}" y="${ty + fontSize + 8}" text-anchor="middle" fill="${color}" font-size="${fontSize}" font-family="monospace" opacity="${progress}">${Math.round(v * 100) / 100}</text>`);
    }
  }

  return `<g>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}" ${dash}/>
    ${ticks.join("")}
  </g>`;
}