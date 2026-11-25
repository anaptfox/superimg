import { clamp } from "./math.js";
import type { Shot, TrimShotOptions } from "./types.js";

/**
 * Wrap a shot function with an in-point (and optional out-point) so reusable
 * shots can be trimmed cleanly without mutating the underlying shot.
 *
 * `ctx.t` is shifted forward by `options.in` (and clamped to `options.out`
 * when given). `ctx.u` reflects progress across `sourceDuration` (or the
 * trimmed window when `sourceDuration` is omitted).
 */
export function trimShot<Data = unknown>(
  shot: Shot<Data>,
  options: TrimShotOptions,
): Shot<Data> {
  const trimIn = options.in;
  if (!Number.isFinite(trimIn) || trimIn < 0) {
    throw new Error(`trimShot() requires a finite non-negative "in" value; received ${trimIn}.`);
  }
  const trimOut = options.out;
  if (trimOut !== undefined && (!Number.isFinite(trimOut) || trimOut <= trimIn)) {
    throw new Error(`trimShot() requires "out" (${trimOut}) to be greater than "in" (${trimIn}).`);
  }
  const sourceDuration = options.sourceDuration;
  if (sourceDuration !== undefined && (!Number.isFinite(sourceDuration) || sourceDuration <= 0)) {
    throw new Error(`trimShot() requires a positive "sourceDuration"; received ${sourceDuration}.`);
  }

  return (ctx) => {
    const rawT = ctx.t + trimIn;
    const t = trimOut !== undefined ? Math.min(rawT, trimOut) : rawT;
    const denom = sourceDuration ?? (trimOut ?? trimIn + ctx.duration);
    const u = denom > 0 ? clamp(t / denom) : 1;
    return shot({ ...ctx, t, u });
  };
}
