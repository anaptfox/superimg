/**
 * Internal shared path parsing and bezier math.
 * Used by path.ts, svg/draw.ts, and svg/morph.ts.
 * NOT exported to consumers.
 */

import { parsePath, absolutize, normalize } from "path-data-parser";
import type { Segment } from "path-data-parser";

export type { Segment };

// --- Bezier math ---

/** Point on a cubic bezier at parameter t (De Casteljau) */
export function cubicPoint(
  x0: number, y0: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  x1: number, y1: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * x0 + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t2 * t * x1,
    y: mt2 * mt * y0 + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t2 * t * y1,
  };
}

/** Tangent vector of a cubic bezier at parameter t */
export function cubicTangent(
  x0: number, y0: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  x1: number, y1: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (c1x - x0) + 6 * mt * t * (c2x - c1x) + 3 * t * t * (x1 - c2x),
    y: 3 * mt * mt * (c1y - y0) + 6 * mt * t * (c2y - c1y) + 3 * t * t * (y1 - c2y),
  };
}

/** Approximate arc length of a cubic bezier via N-segment linear subdivision */
function cubicLengthSamples(
  x0: number, y0: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  x1: number, y1: number,
  n: number,
): number {
  let length = 0;
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const pt = cubicPoint(x0, y0, c1x, c1y, c2x, c2y, x1, y1, t);
    const dx = pt.x - px;
    const dy = pt.y - py;
    length += Math.sqrt(dx * dx + dy * dy);
    px = pt.x;
    py = pt.y;
  }
  return length;
}

// --- Internal segment representation ---

interface LineSegment {
  type: "L";
  x0: number; y0: number;
  x1: number; y1: number;
  length: number;
}

interface CubicSegment {
  type: "C";
  x0: number; y0: number;
  c1x: number; c1y: number;
  c2x: number; c2y: number;
  x1: number; y1: number;
  length: number;
  /** Cumulative arc-length LUT for arc-length parameterization */
  lut: number[];
}

type PathSegment = LineSegment | CubicSegment;

const LUT_SAMPLES = 64;

function buildCubicLUT(seg: Omit<CubicSegment, "lut" | "length">): { lut: number[]; length: number } {
  const lut: number[] = [0];
  let total = 0;
  let px = seg.x0, py = seg.y0;
  for (let i = 1; i <= LUT_SAMPLES; i++) {
    const t = i / LUT_SAMPLES;
    const pt = cubicPoint(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, t);
    const dx = pt.x - px;
    const dy = pt.y - py;
    total += Math.sqrt(dx * dx + dy * dy);
    lut.push(total);
    px = pt.x;
    py = pt.y;
  }
  return { lut, length: total };
}

/** Find bezier parameter t for a target arc length using binary search on LUT */
function lutLookup(lut: number[], targetLen: number): number {
  const total = lut[lut.length - 1];
  if (targetLen <= 0) return 0;
  if (targetLen >= total) return 1;

  // Binary search
  let lo = 0, hi = lut.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (lut[mid] < targetLen) lo = mid;
    else hi = mid;
  }

  // Linear interpolation between lo and hi
  const segLen = lut[hi] - lut[lo];
  const frac = segLen > 0 ? (targetLen - lut[lo]) / segLen : 0;
  return (lo + frac) / LUT_SAMPLES;
}

// --- NormalizedPath ---

export interface NormalizedPath {
  /** Original parsed segments (M, L, C, Z only) */
  rawSegments: Segment[];
  /** Internal segments with precomputed lengths */
  segments: PathSegment[];
  /** Cumulative length at end of each segment */
  cumulative: number[];
  /** Total path length */
  totalLength: number;
}

const cache = new Map<string, NormalizedPath>();

/** Parse and normalize an SVG path string. Results are cached. */
export function normalizePath(d: string): NormalizedPath {
  const cached = cache.get(d);
  if (cached) return cached;

  const raw = normalize(absolutize(parsePath(d)));
  const segments: PathSegment[] = [];
  const cumulative: number[] = [];
  let cx = 0, cy = 0;
  let total = 0;

  for (const seg of raw) {
    switch (seg.key) {
      case "M":
        cx = seg.data[0];
        cy = seg.data[1];
        break;
      case "L": {
        const x1 = seg.data[0], y1 = seg.data[1];
        const dx = x1 - cx, dy = y1 - cy;
        const length = Math.sqrt(dx * dx + dy * dy);
        segments.push({ type: "L", x0: cx, y0: cy, x1, y1, length });
        total += length;
        cumulative.push(total);
        cx = x1;
        cy = y1;
        break;
      }
      case "C": {
        const [c1x, c1y, c2x, c2y, x1, y1] = seg.data;
        const base = { type: "C" as const, x0: cx, y0: cy, c1x, c1y, c2x, c2y, x1, y1 };
        const { lut, length } = buildCubicLUT(base);
        segments.push({ ...base, lut, length });
        total += length;
        cumulative.push(total);
        cx = x1;
        cy = y1;
        break;
      }
      case "Z":
        // Z closes the path — we skip unless it adds a line segment
        break;
    }
  }

  const result: NormalizedPath = { rawSegments: raw, segments, cumulative, totalLength: total };
  cache.set(d, result);
  return result;
}

/** Get {x, y} at a fractional position (0-1) along the path */
export function pointAtProgress(np: NormalizedPath, t: number): { x: number; y: number } {
  t = Math.max(0, Math.min(1, t));
  if (np.segments.length === 0) return { x: 0, y: 0 };

  const targetLen = t * np.totalLength;

  // Find which segment contains the target length
  let segIdx = 0;
  for (; segIdx < np.cumulative.length - 1; segIdx++) {
    if (np.cumulative[segIdx] >= targetLen) break;
  }

  const seg = np.segments[segIdx];
  const prevCum = segIdx > 0 ? np.cumulative[segIdx - 1] : 0;
  const localLen = targetLen - prevCum;

  if (seg.type === "L") {
    const frac = seg.length > 0 ? localLen / seg.length : 0;
    return {
      x: seg.x0 + (seg.x1 - seg.x0) * frac,
      y: seg.y0 + (seg.y1 - seg.y0) * frac,
    };
  }

  // Cubic: use LUT to find bezier parameter
  const bt = lutLookup(seg.lut, localLen);
  return cubicPoint(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, bt);
}

/** Get tangent angle in degrees at a fractional position (0-1) along the path */
export function angleAtProgress(np: NormalizedPath, t: number): number {
  t = Math.max(0, Math.min(1, t));
  if (np.segments.length === 0) return 0;

  const targetLen = t * np.totalLength;

  let segIdx = 0;
  for (; segIdx < np.cumulative.length - 1; segIdx++) {
    if (np.cumulative[segIdx] >= targetLen) break;
  }

  const seg = np.segments[segIdx];
  const prevCum = segIdx > 0 ? np.cumulative[segIdx - 1] : 0;
  const localLen = targetLen - prevCum;

  if (seg.type === "L") {
    return Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0) * (180 / Math.PI);
  }

  const bt = lutLookup(seg.lut, localLen);
  const tan = cubicTangent(seg.x0, seg.y0, seg.c1x, seg.c1y, seg.c2x, seg.c2y, seg.x1, seg.y1, bt);
  return Math.atan2(tan.y, tan.x) * (180 / Math.PI);
}

/** Serialize normalized segments back to a d string */
export function serializePath(segments: Segment[]): string {
  return segments.map(s => {
    if (s.key === "Z") return "Z";
    return `${s.key}${s.data.map(n => Math.round(n * 1000) / 1000).join(",")}`;
  }).join(" ");
}
