import type { Mat, Shape } from "./kit";
import { bounds, chain, hash, move, place, shear, size, turn, wobble } from "./kit";
import type { PegPose, SheetPose } from "./peg";
import { build, poses } from "./peg";
import { material, slabMatrices } from "./clay";
import { lerp } from "./kit";
import type { RadToDeg } from "./clock";

/** peg.ts PIVOT: slabs turn about a point under the deck. */
const PIVOT_Y = 118;
const FLAT: SheetPose = { dx: 0, dy: 0, rot: 0, sx: 1, tip: 0, sc: 1, a: 1 };

/** Slab-space parts for a face, straight from peg.build(), centred on the slab. */
export function slabParts(face: { slot: number; o: number }) {
  const items = build({ ...poses.rest, ...face, wink: 0, x: 0, lift: 0, rot: 0, sx: 1, sy: 1, lean: 0, s: [FLAT, FLAT, FLAT, FLAT], curl: 0, speed: 0, impact: 0, spark: 0 });
  const b = bounds(items.filter(i => i.id === "sheet-0"));
  const centre = move(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
  const get = (id: string) => place(items.find(i => i.id === id)!.shape, centre);
  return [0, 1, 2, 3].map(k => ({ sheet: get(`sheet-${k}`), punch: [`slot-l-${k}`, `hole-${k}`, `slot-r-${k}`].map(get) }));
}

/** The four slab outlines in slab space, as the painter holds them. */
export const sheets: Shape[] = slabParts({ slot: 1, o: 1 }).map(p => p.sheet);
/** The hand-made outline the painter draws for slab k (same seed, same jitter). */
export const handmade = (k: number): Shape => wobble(sheets[k], hash(`sheet-${k}`), material.jitter);

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  const [a, b, c, d] = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det];
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/** Where slab k stands in the world for this pose (the painter's own matrix). */
export const worldOf = (pose: PegPose, k: number): Mat => slabMatrices(pose, sheets)[k];

/** The pose with slab k placed at `world`, independent of the body's squash, lean, turn and travel. */
export function detach(pose: PegPose, k: number, world: Mat, radToDeg: RadToDeg): PegPose {
  const with_ = (s: SheetPose): PegPose => ({ ...pose, s: pose.s.map((v, i) => (i === k ? s : v)) as PegPose["s"] });
  // With the slab flat and absent, its matrix is the body followed by the floor shift.
  const body = worldOf(with_({ ...FLAT, a: 0 }), k);
  const m = chain(world, invert(body));
  // m = size(sx, 1) · shear(tip) · size(sc) · turn(rot, pivot) · move(dx, dy)
  const sc = Math.hypot(m[2], m[3]);
  const rot = Math.atan2(-m[2], m[3]);
  const [c, s] = [Math.cos(rot), Math.sin(rot)];
  const u = (c * m[0] + s * m[1]) / sc;
  const v = (-s * m[0] + c * m[1]) / sc;
  const solved = { sx: u, tip: radToDeg(Math.atan2(v, u)), sc, rot: radToDeg(rot) };
  const still = chain(size(solved.sx, 1), shear(solved.tip), size(sc), turn(solved.rot, 0, PIVOT_Y * sc));
  return with_({ ...solved, dx: m[4] - still[4], dy: m[5] - still[5], a: 0 });
}

/** Entry-wise blend of two nearly upright placements. */
export const blend = (a: Mat, b: Mat, t: number): Mat => a.map((v, i) => lerp(v, b[i], t)) as Mat;
