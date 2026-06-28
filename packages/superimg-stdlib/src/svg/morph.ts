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
 * return `<path d="${d}" fill="#667eea" />`;
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

export function morph(pathA: string, pathB: string, progress: number): string {
  const t = Math.max(0, Math.min(1, progress));
  const { segA, segB } = getMorphPair(pathA, pathB);

  const result: Segment[] = segA.map((sa, i) => {
    const sb = segB[i]!;
    return {
      key: sa.key,
      data: sa.data.map((val: number, j: number) => val + ((sb.data[j] ?? val) - val) * t),
    };
  });

  return serializePath(result);
}
