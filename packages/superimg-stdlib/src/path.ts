/**
 * Motion along SVG paths.
 *
 * Get position, angle, and CSS transform at any point along an SVG path.
 * Caches parsed paths so calling every frame is free after the first parse.
 *
 * @example
 * ```ts
 * const pt = std.path("M0,0 C100,0 100,100 200,100", sceneProgress);
 * return `<div style="position:absolute; ${pt.transform}">🚀</div>`;
 * ```
 */

import { normalizePath, pointAtProgress, angleAtProgress } from "./svg/segments";
import type { NormalizedPath } from "./svg/segments";
import type { EasingName, EasingFn } from "./tween";
import { clamp01 } from "./easing";
import * as easing from "./easing";

const EASING_MAP: Record<string, EasingFn> = easing as unknown as Record<string, EasingFn>;

function resolveEasing(e: EasingName | EasingFn | undefined): EasingFn | undefined {
  if (e === undefined) return undefined;
  if (typeof e === "function") return e;
  return EASING_MAP[e];
}

export interface PathPoint {
  /** X coordinate at this position */
  x: number;
  /** Y coordinate at this position */
  y: number;
  /** Tangent angle in degrees (0 = right, 90 = down) */
  angle: number;
  /** CSS transform string: translate(Xpx, Ypx) rotate(Adeg) */
  transform: string;
}

export interface PathOptions {
  /** Easing applied to progress before sampling. Default: linear */
  easing?: EasingName | EasingFn;
  /** Include rotation in transform. Default: true */
  rotate?: boolean;
  /** Additional rotation offset in degrees. Default: 0 */
  rotateOffset?: number;
}

export interface ParsedPath {
  /** Sample point at normalized position (0-1) */
  at(progress: number, opts?: PathOptions): PathPoint;
  /** Total path length in SVG units */
  length: number;
}

function buildPoint(np: NormalizedPath, progress: number, opts?: PathOptions): PathPoint {
  let t = clamp01(progress);
  const easingFn = resolveEasing(opts?.easing);
  if (easingFn) t = easingFn(t);

  const { x, y } = pointAtProgress(np, t);
  const angle = angleAtProgress(np, t);
  const showRotate = opts?.rotate !== false;
  const offset = opts?.rotateOffset ?? 0;
  const finalAngle = angle + offset;

  const transform = showRotate
    ? `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px) rotate(${Math.round(finalAngle * 100) / 100}deg)`
    : `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px)`;

  return { x, y, angle: finalAngle, transform };
}

/**
 * Get position along an SVG path at a given progress (0-1).
 *
 * @example
 * ```ts
 * const pos = std.path("M0,540 C480,100 1440,100 1920,540", sceneProgress);
 * return `<div style="position:absolute; transform: ${pos.transform}">✈️</div>`;
 * ```
 */
export function path(d: string, progress: number, opts?: PathOptions): PathPoint {
  const np = normalizePath(d);
  return buildPoint(np, progress, opts);
}

/**
 * Pre-parse a path for metadata access and explicit reuse.
 *
 * @example
 * ```ts
 * const flight = std.path.parse("M0,540 C480,100 1440,100 1920,540");
 * console.log(flight.length); // total arc length
 * const pos = flight.at(sceneProgress);
 * ```
 */
export function createMotionPath(d: string): ParsedPath {
  const np = normalizePath(d);
  return {
    at(progress: number, opts?: PathOptions): PathPoint {
      return buildPoint(np, progress, opts);
    },
    get length() {
      return np.totalLength;
    },
  };
}

// Attach parse as a static property for std.path.parse() syntax
(path as any).parse = createMotionPath;
