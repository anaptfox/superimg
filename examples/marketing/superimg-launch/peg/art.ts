// Peg's opaque artwork: the accepted clay painter, drawn as self-contained SVG.
//
// Every mount of Peg in the film comes from here. The painter (clay.ts) is the
// only place Peg's slabs, dents, punch and lighting are drawn; this module only
// wraps one drawing in an SVG document so a typed `Image` can place it. Peg is
// deliberately opaque art: its pose and lent colours are data, its interior is
// not a tree of editable vector nodes.

import type { Place } from "./clay";
import { drawCharacter } from "./clay";
import { pose, spark } from "./motion";
import { frame, VIEWBOX as SCENE_VIEWBOX } from "./frame";
import type { DirectorFactory, Oscillate, RadToDeg } from "./clock";

export type Box = { x: number; y: number; w: number; h: number };
const parse = (v: string): Box => {
  const [x, y, w, h] = v.split(" ").map(Number);
  return { x, y, w, h };
};

/** The card-fan Peg's art box in drawing units. The floor point is (0, 0). */
export const PEG_BOX: Box = { x: -210, y: -250, w: 420, h: 330 };
/** The living-scene frame's art box (Peg and the dealt slab). The floor point is (0, 0). */
export const SCENE_BOX: Box = parse(SCENE_VIEWBOX);

const doc = (box: Box, defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"><defs>${defs}</defs>${body}</svg>`;

/** The card-fan performance at motion time t, in a world's two lent colours. */
export function fanSvg(t: number, place: Place, uid: string): string {
  const c = drawCharacter(pose(t), { uid, place, spark: spark(t) });
  return doc(PEG_BOX, c.defs, c.body);
}

export type Clock = { director: DirectorFactory; oscillate: Oscillate; radToDeg: RadToDeg };

/** The new trick (deal, present, reclaim) at trick time t, with the slab's miniature at its own time s. No stage: the film owns the ground. */
export function trickSvg(t: number, s: number, clock: Clock, uid: string): string {
  return frame(t, s, clock.director, clock.oscillate, clock.radToDeg, uid, false).svg;
}

export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
