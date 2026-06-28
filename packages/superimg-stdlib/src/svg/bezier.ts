import {
  cubicPoint,
  cubicTangent,
  normalizePath,
  pointAtProgress,
  angleAtProgress,
} from "./segments.js";

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cubic bezier segment as SVG path fragment (no leading M). */
export function cubic(p0: Point2D, c1: Point2D, c2: Point2D, p1: Point2D): string {
  return `M${r3(p0.x)},${r3(p0.y)} C${r3(c1.x)},${r3(c1.y)} ${r3(c2.x)},${r3(c2.y)} ${r3(p1.x)},${r3(p1.y)}`;
}

/** Quadratic bezier as SVG path (converted to cubic for consistency). */
export function quadratic(p0: Point2D, c: Point2D, p1: Point2D): string {
  const c1x = p0.x + (2 / 3) * (c.x - p0.x);
  const c1y = p0.y + (2 / 3) * (c.y - p0.y);
  const c2x = p1.x + (2 / 3) * (c.x - p1.x);
  const c2y = p1.y + (2 / 3) * (c.y - p1.y);
  return cubic(p0, { x: c1x, y: c1y }, { x: c2x, y: c2y }, p1);
}

/** Catmull-Rom spline through points → single closed/open path d string. */
export function smooth(points: Point2D[], tension = 0.5, closed = false): string {
  if (points.length < 2) return "";
  const parts: string[] = [`M${r3(points[0]!.x)},${r3(points[0]!.y)}`];
  const n = points.length;
  const last = closed ? n : n - 1;

  for (let i = 0; i < last; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i % n]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    parts.push(`C${r3(c1x)},${r3(c1y)} ${r3(c2x)},${r3(c2y)} ${r3(p2.x)},${r3(p2.y)}`);
  }
  if (closed) parts.push("Z");
  return parts.join(" ");
}

export function pointAt(d: string, t: number): Point2D {
  return pointAtProgress(normalizePath(d), t);
}

export function tangentAt(d: string, t: number): number {
  return angleAtProgress(normalizePath(d), t);
}

/** Rough axis-aligned bounds of a path (samples along length). */
export function bounds(d: string): Bounds {
  const np = normalizePath(d);
  if (np.totalLength === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const samples = 32;
  for (let i = 0; i <= samples; i++) {
    const p = pointAtProgress(np, i / samples);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

