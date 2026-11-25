import type { Mat, Shape } from "./kit";
import { bounds, circle, ellipse, flatten, fmt, hash, pathD, place, shadow, size, tint, wobble } from "./kit";
import { skin } from "./peg";
import type { Dyn, Place } from "./clay";
import { material } from "./clay";
import { handmade, sheets, slabParts } from "./slab";
import { lerp } from "./kit";

/** The knobs for the picture. Slab space: the slab is 128 x 96 about its centre. */
export const picture = {
  /** Blue left showing around the tile. */
  margin: 8,
  /** Which of Peg's slab colours paints what. */
  paint: { tile: "sheet0", sun: "sheet1", far: "sheet2", near: "sheet3" },
  sun: { r: 14, x: 14, down: 40, up: -10 },
  far: { x: 34, y: 56, rx: 62, ry: 40 },
  near: { x: -34, y: 60, rx: 54, ry: 46 },
  /** Thumb dents on the tile, kept off the picture: [x, y, rx, ry, depth]. */
  dents: [[-36, -20, 14, 10, 0.9], [4, -29, 10, 7, 0.6]] as [number, number, number, number, number][],
  /** true cuts the slab's slot, hole, slot through the picture. false: the tile covers them. */
  punched: false,
  /** How the dealt slab's punch sits while it is out: still, and not Peg's live face. */
  punch: { slot: 1, o: 1 },
};

const grad = (role: string) => (skin.palette[role] as { grad: [string, string] }).grad;
const mat = (m: Mat) => `matrix(${m.map(v => Math.round(v * 10000) / 10000).join(" ")})`;
const made = (shape: Shape, name: string) => pathD(wobble(shape, hash(name), material.jitter));

export type CardInput = { slab: Mat; away: number; lift: number; faceUp: boolean; sun: number };
export type Card = { defs: string; under: string; over: string; dyn: Dyn };

export function drawCard(input: CardInput, opts: { uid: string; place: Place; content?: string }): Card {
  const P = picture;
  const [lx, ly] = material.light;
  const id = (name: string) => `${opts.uid}-card-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  /** Something the painter already defined under the same uid. */
  const borrowed = (name: string) => `url(#${opts.uid}-${name})`;
  const dyn: Dyn = [];
  const live = (name: string, attr: string, value: string) => {
    dyn.push([id(name), attr, value]);
    return `id="${id(name)}" ${attr}="${value}"`;
  };
  const live2 = (name: string, a: [string, string], b: [string, string]) => {
    dyn.push([id(name), a[0], a[1]], [id(name), b[0], b[1]]);
    return `id="${id(name)}" ${a[0]}="${a[1]}" ${b[0]}="${b[1]}"`;
  };

  // ── defs ────────────────────────────────────────────────────────────────
  const blue = grad("sheet3")[1];
  const defs: string[] = Object.entries(P.paint).map(([name, role]) => {
    const [from, to] = grad(role);
    return `<linearGradient id="${id(`paint-${name}`)}" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient>`;
  });
  // The tile: the slab's own hand-made outline, pulled in by the margin.
  const tile = pathD(place(handmade(3), size(1 - (2 * P.margin) / 128, 1 - (2 * P.margin) / 96)));
  const holes = slabParts(P.punch)[3].punch.map(pathD).join("");
  /** A soft shadow thrown away from the lamp, under a raised shape. */
  const raised = (name: string, height: number, color: string, alpha: number) =>
    `<filter id="${id(name)}" x="-20%" y="-25%" width="140%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${fmt(height * 0.55)}"/><feOffset dx="${fmt(lx * height)}" dy="${fmt(ly * height)}" result="s"/><feFlood flood-color="${color}" flood-opacity="${alpha}"/><feComposite in2="s" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  defs.push(
    `<clipPath id="${id("tile")}"><path d="${tile}"/></clipPath>`,
    `<mask id="${id("punched")}" maskUnits="userSpaceOnUse" x="-70" y="-54" width="140" height="108"><rect x="-70" y="-54" width="140" height="108" fill="#fff"/>${P.punched ? `<path d="${holes}" fill="#000" stroke="#000" stroke-width="3"/>` : ""}</mask>`,
    `<filter id="${id("soft")}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.3"/></filter>`,
    raised("lift-tile", 2.6, tint(blue, material.deep, 0.6), 0.55),
    raised("lift-piece", 1.8, tint(grad("sheet0")[1], material.deep, 0.55), 0.4),
  );

  // ── the slab's own floor shadow, same recipe as the painter's ───────────
  const box = bounds([{ id: "", role: "", shape: place(sheets[3], input.slab) }]);
  const ground = shadow((box.x0 + box.x1) / 2, (box.x1 - box.x0) * 0.92, input.lift);
  const pts = flatten(ground.shape, 2);
  const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const op = (ground.opacity ?? 1) * input.away;
  const along = (d: number) => `translate(${fmt(lx * d)} ${fmt(ly * d)})`;
  defs.push(
    `<filter id="${id("pool-blur")}" x="-16%" y="-90%" width="132%" height="280%"><feGaussianBlur stdDeviation="6"/></filter>`,
    `<filter id="${id("core-blur")}" x="-10%" y="-90%" width="120%" height="280%"><feGaussianBlur stdDeviation="2.6"/></filter>`,
  );
  const under =
    `<path ${live2("pool", ["d", pathD(place(ground.shape, size(1.2, 1.55, cx, cy)))], ["opacity", (op * 0.6).toFixed(3)])} transform="${along(9)}" fill="${opts.place.shadow}" filter="${ref("pool-blur")}"/>` +
    `<path ${live2("core", ["d", pathD(place(ground.shape, size(0.92, 0.8, cx, cy)))], ["opacity", (op * 0.55).toFixed(3)])} transform="${along(3)}" fill="${tint(opts.place.shadow, material.deep, 0.3)}" filter="${ref("core-blur")}"/>`;

  // ── the picture ─────────────────────────────────────────────────────────
  // Surface borrowed from the painter's defs: its tooth tile and the cream slab's dent gradients.
  const dents = P.dents.map(([x, y, rx, ry, depth]) =>
    `<ellipse cx="${fmt(x - lx * 3 * depth)}" cy="${fmt(y - ly * 3 * depth)}" rx="${rx}" ry="${ry}" fill="${borrowed("dent-dark-0")}" opacity="${depth}"/>` +
    `<ellipse cx="${fmt(x + lx * 3 * depth)}" cy="${fmt(y + ly * 3 * depth)}" rx="${rx}" ry="${ry}" fill="${borrowed("dent-lit-0")}" opacity="${depth}"/>`).join("");
  const [paper, paperShade] = grad(P.paint.tile);
  const surface =
    `<g opacity="${material.dent}">${dents}</g>` +
    `<rect x="-64" y="-48" width="128" height="96" fill="${borrowed("tooth")}" opacity="${material.tooth}"/>`;
  // A rolled edge, simply: light just inside the edges facing the lamp, shade inside the far ones.
  const roll =
    `<g fill="none" filter="${ref("soft")}">` +
    `<path d="${tile}" transform="translate(${fmt(lx * 1.6)} ${fmt(ly * 1.6)})" stroke="${tint(paper, "#ffffff", 0.7)}" stroke-width="2.4" opacity="0.8"/>` +
    `<path d="${tile}" transform="translate(${fmt(-lx * 1.8)} ${fmt(-ly * 1.8)})" stroke="${tint(paperShade, material.deep, 0.4)}" stroke-width="3" opacity="0.4"/>` +
    `</g>`;
  const piece = (name: string, d: string) => `<path d="${d}" fill="${ref(`paint-${name}`)}" filter="${ref("lift-piece")}"/>`;
  const over =
    `<g ${live2("picture", ["transform", mat(input.slab)], ["visibility", input.faceUp ? "visible" : "hidden"])}>` +
    `<g mask="${ref("punched")}">` +
    `<path d="${tile}" fill="${ref("paint-tile")}" filter="${ref("lift-tile")}"/>` +
    `<g clip-path="${ref("tile")}">` + surface +
    (opts.content ?? (`<g ${live("sun", "transform", `translate(0 ${fmt(lerp(P.sun.down, P.sun.up, input.sun))})`)}>${piece("sun", made(circle(P.sun.x, 0, P.sun.r), "pic-sun"))}</g>` +
    piece("far", made(ellipse(P.far.x, P.far.y, P.far.rx, P.far.ry, 28), "pic-far")) +
    piece("near", made(ellipse(P.near.x, P.near.y, P.near.rx, P.near.ry, 28), "pic-near")))) +
    roll +
    `</g></g></g>`;

  return { defs: defs.join(""), under, over, dyn };
}
