import type { PegPose, SheetPose } from "./peg";
import { poses } from "./peg";
import { clamp, lerp } from "./kit";

export const DURATION = 5.2;

/** Beat boundaries, for the scrub bar and the notes. */
export const beats = [
  { at: 0, label: "rest" },
  { at: 0.85, label: "gather" },
  { at: 1.35, label: "fan" },
  { at: 2.05, label: "show" },
  { at: 3.25, label: "settle" },
  { at: 4.15, label: "rest" },
] as const;

/** The knobs. Every timing and amount Fox might want to nudge lives here. */
export const timing = {
  /** Gather: how hard it squashes and squares the deck before the fan. */
  gatherSquash: 0.9,
  gatherStep: 3,
  /** Rest stack step (from peg.ts `stack(8)`). */
  restStep: 8,
  /** Fan: per-slab delay, front slab first, and how long each slab takes. */
  fanStagger: 0.06,
  fanEach: 0.44,
  /** Little hop on release, in drawing units. 0 keeps it grounded. */
  hop: 6,
  /** Settle: per-slab delay and duration as the fan closes. */
  closeStagger: 0.055,
  closeEach: 0.5,
  /** Fraction of the rest step the back slabs overshoot as they restack. */
  restackOvershoot: 0.08,
  /** The wink during the show. 0 removes it. */
  wink: 1,
};

// ── easing ────────────────────────────────────────────────────────────────

type Ease = (u: number) => number;
const out: Ease = u => 1 - Math.pow(1 - u, 3);
const inn: Ease = u => u * u * u;
const inOut: Ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** Same curve as kit.ts `ease.back`: about 5% overshoot, then settles. */
const back: Ease = u => 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
const sine: Ease = u => 0.5 - Math.cos(Math.PI * u) / 2;

type Key = [at: number, value: number, ease?: Ease];
/** Piecewise track. Each key's ease shapes the move that arrives at it. */
function track(keys: Key[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, (e ?? inOut)(clamp((t - t0) / (t1 - t0 || 1))));
    }
  }
  return keys[keys.length - 1][1];
}
const span = (t: number, start: number, length: number) => clamp((t - start) / length);

// ── the trick ─────────────────────────────────────────────────────────────

const fanRot = poses.fan.s.map(s => s.rot); // [-15, -5, 5, 15]
const restBody = poses.rest;
const fanBody = poses.fan;

export function pose(t: number): PegPose {
  const T = timing;
  t = ((t % DURATION) + DURATION) % DURATION;

  // Body. Volume-ish: when it squashes it widens.
  const sy = track([
    [0, 1], [0.85, 1],
    [1.35, T.gatherSquash, inOut],      // gather
    [1.55, 1.05, out],                  // release stretch
    [1.88, 1, inOut],
    [1.97, 0.965, out],                 // lands from the hop
    [2.14, 1, out],
    [2.5, 1.015, sine],                 // proud: a small chest-out
    [3.25, 1, sine],
    [3.86, 1],
    [3.98, 0.965, out],                 // the deck lands back on itself
    [4.22, 1, out],
  ], t);
  const sx = 1 + (1 - sy) * 0.6;
  const x = track([[0, restBody.x], [0.85, restBody.x], [1.35, restBody.x - 3, inOut], [1.9, fanBody.x, out], [3.25, fanBody.x], [4.05, restBody.x, inOut]], t);
  const rot = track([
    [0, restBody.rot], [0.85, restBody.rot],
    [1.35, restBody.rot - 3, inOut],    // wind up against the sweep
    [1.95, 0, back],
    [2.5, 0],
    [2.62, 2.5 * T.wink, out],          // tilts into the wink
    [2.95, 0, inOut],
    [3.25, 0],
    [4.05, restBody.rot, inOut],
  ], t);
  const lift = track([[0, 0], [1.35, 0], [1.6, T.hop, out], [1.88, 0, inn]], t);
  const leanDeg = track([[0, 0], [0.85, 0], [1.35, -3, inOut], [1.6, 2.5, out], [2.0, 0, inOut], [3.25, 0], [3.6, -1.5, inOut], [4.05, 0, inOut]], t);

  // Face. A blink while it pretends nothing is happening, a squint to
  // concentrate, an "oh" for the reveal, then a smug wink.
  const slot = track([[0, 1], [0.38, 1], [0.47, 0.15, inn], [0.6, 1, out], [0.85, 1], [1.3, 0.5, inOut], [1.4, 0.5], [1.55, 1, out]], t);
  const wink = T.wink * track([[0, 0], [2.5, 0], [2.62, 1, out], [2.85, 1], [2.97, 0, out]], t);
  const o = track([[0, 1], [0.85, 1], [1.3, 0.85, inOut], [1.42, 0.85], [1.7, fanBody.o, back], [2.5, fanBody.o], [2.62, 1.05, out], [3.25, 1.05], [3.7, 1, inOut]], t);

  // Slabs. Front slab leads both ways; the back ones follow through.
  const step = track([[0, T.restStep], [0.85, T.restStep], [1.35, T.gatherStep, inOut]], t);
  const breathEnv = t < 1.1 ? 1 - span(t, 0.85, 0.25) : span(t, 4.0, 0.4);
  const breath = Math.sin((t / DURATION) * Math.PI * 4) * 0.5 * breathEnv;
  const s = [0, 1, 2, 3].map((k): SheetPose => {
    const open = span(t, 1.38 + k * T.fanStagger, T.fanEach);
    const close = span(t, 3.25 + k * T.closeStagger, T.closeEach);
    const spread = back(open) * (1 - inOut(close));
    // Restacking rides the same curve as the rotation, so a slab never rises
    // off the deck before it has turned home; a small overshoot at the end is
    // the follow-through as it beds down.
    const settle = inOut(close) + T.restackOvershoot * Math.pow(Math.sin(Math.PI * span(close, 0.55, 0.45)), 2);
    const stacked = close > 0 ? T.restStep * settle : lerp(step, 0, out(open));
    return {
      dx: stacked * k, dy: -stacked * k - breath * k * 0.7,
      rot: fanRot[k] * spread, sx: 1, tip: 0, sc: 1, a: 1,
    };
  }) as PegPose["s"];

  return {
    ...restBody,
    x, lift, rot, sx, sy, lean: leanDeg, s,
    slot, wink, o, curl: 0, speed: 0, impact: 0,
    spark: 0, // drawn by the painter from `spark(t)`, so it can draw on and off
  };
}

/** Spark ticks: [drawn-from, drawn-to] along each tick, 0..1. Draws on, holds, retracts. */
export function spark(t: number): [number, number] {
  t = ((t % DURATION) + DURATION) % DURATION;
  return [inn(span(t, 3.02, 0.14)), out(span(t, 1.9, 0.16))];
}

/** The beat label at t. */
export function beatAt(t: number): string {
  let label: string = beats[0].label;
  for (const b of beats) if (t >= b.at) label = b.label;
  return label;
}
