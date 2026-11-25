import { studio } from "./world";
import type { Dyn } from "./clay";
import { drawCharacter, stage } from "./clay";
import { drawCard, picture } from "./card";
import { moment } from "./trick";
import { drawScene, sceneAt } from "./scene";
import type { DirectorFactory, Oscillate, RadToDeg } from "./clock";

export type Frame = { svg: string; dyn: Dyn };

/** The art box: wide enough for Peg and the slab side by side. */
export const VIEWBOX = "-170 -186 340 216";

export function frame(t: number, sceneTime: number, createDirector: DirectorFactory, oscillate: Oscillate, radToDeg: RadToDeg, uid = "pn", ground: string | false = stage): Frame {
  const m = moment(t, createDirector, oscillate, radToDeg);
  const scene = drawScene(sceneAt(sceneTime, createDirector), { id: name => `${uid}-scene-${name}`, paint: {sun: `url(#${uid}-card-paint-sun)`, far: `url(#${uid}-card-paint-far)`, near: `url(#${uid}-card-paint-near)`}, lift: `url(#${uid}-card-lift-piece)` });
  const peg = drawCharacter(m.pose, { uid, place: studio, spark: m.spark });
  let { defs, dyn } = peg;
  if (m.out) {
    const still = drawCharacter({ ...m.pose, ...picture.punch, wink: 0 }, { uid, place: studio });
    const punch = still.dyn.find(([id, attr]) => id === `${uid}-punch-3` && attr === "d")!;
    dyn = dyn.map(entry => (entry[0] === punch[0] && entry[1] === "d" ? punch : entry));
    defs = defs.replace(new RegExp(`(<path id="${uid}-punch-3" d=")[^"]*`), (_, head: string) => head + punch[2]);
  }
  const card = drawCard({ slab: m.slab, away: m.away, lift: m.slabLift, faceUp: m.faceUp, sun: m.sun }, { uid, place: studio, content: scene.body });
  const [x, y, w, h] = VIEWBOX.split(" ").map(Number);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Peg, a stack of four soft clay slabs with a punched face, deals its blue slab out to stand beside it, shows a tiny moving scene on it, a sun hopping between two hills, then takes it back">` +
    `<defs>${defs}${card.defs}</defs>${ground === false ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ground}"/>`}${card.under}${peg.body}${card.over}</svg>`;
  return { svg, dyn: [...dyn, ...card.dyn, ...scene.dyn] };
}
