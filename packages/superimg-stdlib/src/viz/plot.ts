import type { CoordSystem } from "./coords.js";

export interface PlotOptions {
  samples?: number;
  adaptive?: boolean;
  color?: string;
  strokeWidth?: number;
  progress?: number;
  fill?: boolean;
  fillOpacity?: number;
}

function pathLength(points: Array<[number, number]>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function buildPathD(
  coords: CoordSystem,
  fn: (x: number) => number,
  samples: number,
  adaptive: boolean
): string {
  const { xRange } = coords.config;
  const [xMin, xMax] = xRange;
  const step = (xMax - xMin) / samples;
  const maxY = coords.plotHeight * 3;

  type Seg = { x: number; px: number; py: number; valid: boolean };

  function evalSeg(x: number): Seg {
    const y = fn(x);
    const valid = !isNaN(y) && isFinite(y) && Math.abs(y) <= maxY + 1e6;
    const { px, py } = coords.toPixel(x, valid ? y : 0);
    return { x, px, py, valid };
  }

  const rawSegs: Seg[] = [];
  for (let i = 0; i <= samples; i++) {
    rawSegs.push(evalSeg(xMin + i * step));
  }

  // Adaptive subdivision
  const finalSegs: Seg[] = [rawSegs[0]];
  for (let i = 1; i < rawSegs.length; i++) {
    const prev = rawSegs[i - 1];
    const curr = rawSegs[i];
    if (adaptive && i >= 2) {
      const pprev = rawSegs[i - 2];
      const curvature = Math.abs(curr.py - 2 * prev.py + pprev.py);
      if (curvature > 2) {
        // One level of subdivision
        const mx = (prev.x + curr.x) / 2;
        finalSegs.push(evalSeg(mx));
        // Second level
        if (curvature > 8) {
          finalSegs.push(evalSeg((prev.x + mx) / 2));
          finalSegs.push(evalSeg((mx + curr.x) / 2));
        }
      }
    }
    finalSegs.push(curr);
  }

  // Sort by x after adaptive insertion
  finalSegs.sort((a, b) => a.x - b.x);

  // Build path segments
  const parts: string[] = [];
  let penDown = false;
  const strokePoints: Array<[number, number]> = [];

  for (const seg of finalSegs) {
    const outOfView = Math.abs(coords.toPixel(seg.x, fn(seg.x)).py - coords.plotTop) > coords.plotHeight * 3;
    if (!seg.valid || outOfView) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      parts.push(`M ${seg.px.toFixed(2)} ${seg.py.toFixed(2)}`);
      penDown = true;
    } else {
      parts.push(`L ${seg.px.toFixed(2)} ${seg.py.toFixed(2)}`);
    }
    strokePoints.push([seg.px, seg.py]);
  }

  return parts.join(" ");
}

export function plot(
  coords: CoordSystem,
  fn: (x: number) => number,
  opts: PlotOptions = {}
): string {
  const {
    samples = 200,
    adaptive = true,
    color = "#4a9eff",
    strokeWidth = 2.5,
    progress = 1,
    fill = false,
    fillOpacity = 0.15,
  } = opts;

  const d = buildPathD(coords, fn, samples, adaptive);

  // Estimate path length for dash animation
  let dashAttr = "";
  if (progress < 1) {
    // Rough estimate: sample evenly and sum distances
    const { xRange } = coords.config;
    const [xMin, xMax] = xRange;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = xMin + (i / 300) * (xMax - xMin);
      const y = fn(x);
      if (!isNaN(y) && isFinite(y)) {
        const { px, py } = coords.toPixel(x, y);
        pts.push([px, py]);
      }
    }
    const len = pathLength(pts);
    dashAttr = `stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - progress)).toFixed(1)}"`;
  }

  const strokePath = `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" ${dashAttr}/>`;

  if (!fill) return strokePath;

  // Fill path: close at y=0
  const { py: zeroY } = coords.toPixel(0, 0);
  const { xRange } = coords.config;
  const [xMin, xMax] = xRange;
  const { px: startPx } = coords.toPixel(xMin, fn(xMin));
  const { px: endPx } = coords.toPixel(xMax, fn(xMax));
  const fillD = `${d} L ${endPx.toFixed(2)} ${zeroY.toFixed(2)} L ${startPx.toFixed(2)} ${zeroY.toFixed(2)} Z`;
  const fillPath = `<path d="${fillD}" fill="${color}" fill-opacity="${fillOpacity}" stroke="none"/>`;

  return `${fillPath}${strokePath}`;
}

export interface ParametricOptions extends PlotOptions {
  tMin?: number;
  tMax?: number;
}

export function parametric(
  coords: CoordSystem,
  fn: (t: number) => [number, number],
  opts: ParametricOptions = {}
): string {
  const {
    tMin = 0,
    tMax = 1,
    samples = 200,
    color = "#4a9eff",
    strokeWidth = 2.5,
    progress = 1,
  } = opts;

  const maxY = coords.plotHeight * 3;
  const parts: string[] = [];
  let penDown = false;
  const pts: Array<[number, number]> = [];

  for (let i = 0; i <= samples; i++) {
    const t = tMin + (i / samples) * (tMax - tMin);
    const [x, y] = fn(t);
    const valid = !isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y) && Math.abs(y) < maxY + 1e6;
    if (!valid) { penDown = false; continue; }
    const { px, py } = coords.toPixel(x, y);
    if (!penDown) {
      parts.push(`M ${px.toFixed(2)} ${py.toFixed(2)}`);
      penDown = true;
    } else {
      parts.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
    }
    pts.push([px, py]);
  }

  const d = parts.join(" ");
  let dashAttr = "";
  if (progress < 1) {
    const len = pathLength(pts);
    dashAttr = `stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - progress)).toFixed(1)}"`;
  }

  return `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" ${dashAttr}/>`;
}

export interface VectorOptions {
  color?: string;
  strokeWidth?: number;
  arrowSize?: number;
  progress?: number;
  label?: string;
  labelOffset?: { x?: number; y?: number };
  fontSize?: number;
}

export function vector(
  coords: CoordSystem,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: VectorOptions = {}
): string {
  const {
    color = "#f97316",
    progress = 1,
    label,
    labelOffset = {},
    fontSize = 14,
  } = opts;

  const { px: px1, py: py1 } = coords.toPixel(x1, y1);
  const { px: px2, py: py2 } = coords.toPixel(x2, y2);

  const dx = px2 - px1;
  const dy = py2 - py1;
  const vecLenPx = Math.sqrt(dx * dx + dy * dy);

  const headPx = opts.arrowSize ?? Math.min(Math.max(vecLenPx * 0.15, 8), 28);
  const strokeWidth = opts.strokeWidth ?? Math.min(Math.max(vecLenPx * 0.02, 1.5), 4);

  // Unit direction
  const ux = vecLenPx > 0 ? dx / vecLenPx : 1;
  const uy = vecLenPx > 0 ? dy / vecLenPx : 0;

  // Shaft ends before the arrowhead tip so stroke doesn't poke through
  const shaftEndX = px2 - ux * headPx;
  const shaftEndY = py2 - uy * headPx;

  // Arrow triangle points
  const perpX = -uy * headPx * 0.4;
  const perpY = ux * headPx * 0.4;
  const arrowPts = `${px2.toFixed(2)},${py2.toFixed(2)} ${(shaftEndX + perpX).toFixed(2)},${(shaftEndY + perpY).toFixed(2)} ${(shaftEndX - perpX).toFixed(2)},${(shaftEndY - perpY).toFixed(2)}`;

  // Shaft dash for progress animation
  let dashAttr = "";
  const shaftLen = Math.sqrt((shaftEndX - px1) ** 2 + (shaftEndY - py1) ** 2);
  if (progress < 1) {
    dashAttr = `stroke-dasharray="${shaftLen.toFixed(1)}" stroke-dashoffset="${(shaftLen * (1 - progress)).toFixed(1)}"`;
  }

  const arrowOpacity = progress >= 0.95 ? 1 : 0;
  const shaft = `<line x1="${px1.toFixed(2)}" y1="${py1.toFixed(2)}" x2="${shaftEndX.toFixed(2)}" y2="${shaftEndY.toFixed(2)}" stroke="${color}" stroke-width="${strokeWidth}" ${dashAttr}/>`;
  const head = `<polygon points="${arrowPts}" fill="${color}" opacity="${arrowOpacity}"/>`;

  let labelEl = "";
  if (label) {
    const lx = px2 + (labelOffset.x ?? 10);
    const ly = py2 + (labelOffset.y ?? -10);
    labelEl = `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="${color}" font-size="${fontSize}" font-family="sans-serif" opacity="${progress}">${label}</text>`;
  }

  return `<g>${shaft}${head}${labelEl}</g>`;
}

export function vectorFrom(
  coords: CoordSystem,
  x: number,
  y: number,
  opts: VectorOptions = {}
): string {
  return vector(coords, 0, 0, x, y, opts);
}

export interface PointOptions {
  color?: string;
  radius?: number;
  label?: string;
  labelOffset?: { x?: number; y?: number };
  fontSize?: number;
  progress?: number;
}

export function point(
  coords: CoordSystem,
  x: number,
  y: number,
  opts: PointOptions = {}
): string {
  const {
    color = "#a78bfa",
    radius = 5,
    label,
    labelOffset = {},
    fontSize = 13,
    progress = 1,
  } = opts;

  const { px, py } = coords.toPixel(x, y);
  const r = radius * progress;

  let labelEl = "";
  if (label) {
    const lx = px + (labelOffset.x ?? 10);
    const ly = py + (labelOffset.y ?? -10);
    labelEl = `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="${color}" font-size="${fontSize}" font-family="sans-serif" opacity="${progress}">${label}</text>`;
  }

  return `<g>
    <circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" opacity="${progress}"/>
    ${labelEl}
  </g>`;
}
