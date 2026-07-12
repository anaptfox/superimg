/**
 * SVG path morphing — interpolate between two path d strings.
 *
 * Both paths must normalize to the same number and type of segments.
 * Use std.svg.shape generators for guaranteed-compatible shapes.
 *
 * @example
 * ```ts
 * const a = std.svg.shape.polygon(100, 100, 80, 10);
 * const b = std.svg.shape.star(100, 100, 80, 35, 5);
 * const d = std.svg.morph(a, b, timeline.progress);
 * // arc path (Manim path_along_arc feel):
 * const d2 = std.svg.morph(a, b, p, { arc: Math.PI / 2 });
 * ```
 */

import { normalizePath, serializePath, type Segment } from "./segments.js";

interface MorphPair {
  segA: Segment[];
  segB: Segment[];
}

const pairCache = new Map<string, MorphPair>();

function getMorphPair(pathA: string, pathB: string): MorphPair {
  const key = pathA + "|" + pathB;
  const cached = pairCache.get(key);
  if (cached) return cached;

  const npA = normalizePath(pathA);
  const npB = normalizePath(pathB);
  const segA = npA.rawSegments;
  const segB = npB.rawSegments;

  if (segA.length !== segB.length) {
    throw new Error(
      `svg.morph: paths must have the same number of segments after normalization. ` +
      `Path A has ${segA.length} segments, path B has ${segB.length}. ` +
      `Use std.svg.shape generators for compatible shapes.`,
    );
  }

  for (let i = 0; i < segA.length; i++) {
    const a = segA[i];
    const b = segB[i];
    if (!a || !b) continue;
    if (a.key !== b.key) {
      throw new Error(
        `svg.morph: segment ${i} type mismatch — path A has "${a.key}", path B has "${b.key}".`,
      );
    }
    if (a.data.length !== b.data.length) {
      throw new Error(
        `svg.morph: segment ${i} data length mismatch — path A has ${a.data.length} values, path B has ${b.data.length}.`,
      );
    }
  }

  const pair = { segA, segB };
  pairCache.set(key, pair);
  return pair;
}

export interface MorphOptions {
  /**
   * Arc rotation (radians) applied to the midpoint offset (Manim path_along_arc).
   * 0 = straight linear morph (default). π/2 = quarter-circle bow.
   */
  arc?: number;
}

/**
 * Interpolate path coordinates. With `arc`, midpoints swing off the chord
 * for more organic morph motion.
 */
export function morph(
  pathA: string,
  pathB: string,
  progress: number,
  opts: MorphOptions = {},
): string {
  const t = Math.max(0, Math.min(1, progress));
  const { segA, segB } = getMorphPair(pathA, pathB);
  const arc = opts.arc ?? 0;

  // Arc envelope: 0 at ends, 1 at mid
  const bow = arc !== 0 ? Math.sin(t * Math.PI) : 0;
  const cosA = arc !== 0 ? Math.cos(arc) : 1;
  const sinA = arc !== 0 ? Math.sin(arc) : 0;

  const result: Segment[] = segA.map((sa, i) => {
    const sb = segB[i]!;
    return {
      key: sa.key,
      data: sa.data.map((val: number, j: number) => {
        const target = sb.data[j] ?? val;
        const linear = val + (target - val) * t;
        if (bow === 0) return linear;
        // Pair x,y components: even index = x-ish, odd = y-ish when length even
        // Rotate (target-val) offset by arc and scale by bow for mid bulge
        const dx = target - val;
        // Use orthogonal component for bow: rotate delta by arc around midpoint path
        if (j % 2 === 0 && j + 1 < sa.data.length) {
          // x component — bow applied with y coupling on next index in same map pass
          const dy = (sb.data[j + 1] ?? sa.data[j + 1] ?? 0) - (sa.data[j + 1] ?? 0);
          const ox = dx * cosA - dy * sinA;
          return linear + ox * bow * 0.35;
        }
        if (j % 2 === 1) {
          const dxPrev = (sb.data[j - 1] ?? sa.data[j - 1] ?? 0) - (sa.data[j - 1] ?? 0);
          const dy = dx; // this component's delta
          const oy = dxPrev * sinA + dy * cosA;
          return linear + oy * bow * 0.35;
        }
        return linear;
      }),
    };
  });

  return serializePath(result);
}

/**
 * Position lerp with arc path (for element centers, not path d strings).
 * Returns { x, y } along an arc from a→b.
 */
export function arcPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
  arcRadians = Math.PI / 2,
): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, progress));
  const mx = from.x + (to.x - from.x) * t;
  const my = from.y + (to.y - from.y) * t;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bow = Math.sin(t * Math.PI);
  // Perpendicular unit * arc magnitude
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const mag = (arcRadians / (Math.PI / 2)) * (len * 0.35) * bow;
  return { x: mx + px * mag, y: my + py * mag };
}
