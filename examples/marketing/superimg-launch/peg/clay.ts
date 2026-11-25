import type { Mat, Pt, Shape } from "./kit";
import { VIEW, bounds, chain, flatten, fmt, hash, lean, move, pathD, place, shear, size, tint, turn, wobble } from "./kit";
import type { PegPose } from "./peg";
import { build, poses, skin } from "./peg";
import { studio } from "./world";
import { pose as poseAt, spark as sparkAt } from "./motion";

/** The knobs. Same names as sculpt.ts where the meaning is the same. */
export const material = {
  depth: 7.5,
  light: [0.55, 0.835] as Pt,
  jitter: 0.8,
  deep: "#2a1208",
  /** Edge roll. Wider and softer than B (3.4) so the edge reads as clay, not foam. */
  roll: 3.8,
  cast: { soft: [5.5, 3.6, 0.3], tight: [1.6, 1.2, 0.4] },
  /** B's grain was 0.42 and dimple 0.27, frame-fixed. These are slab-fixed. */
  dent: 0.5,
  tooth: 0.1,
};

export const stage = studio.bg;
/** What a world lends Peg: the colour of its action lines and of its contact shadow. */
export type Place = { fx: string; shadow: string };
const K = [0, 1, 2, 3];
/** peg.ts PIVOT: slabs fan about a point under the deck. Checked against build() in build.ts. */
const PIVOT_Y = 118;

const n = (v: number) => fmt(v);
const mat = (m: Mat) => `matrix(${m.map(v => Math.round(v * 10000) / 10000).join(" ")})`;
const palette = (k: number) => (skin.palette[`sheet${k}`] as { grad: [string, string] }).grad;

// ── geometry ────────────────────────────────────────────────────────────

/** A neutral build: every slab square on the origin, body untransformed. */
function neutral(p: PegPose): PegPose {
  const flat = { dx: 0, dy: 0, rot: 0, sx: 1, tip: 0, sc: 1, a: 1 };
  return { ...p, x: 0, lift: 0, rot: 0, sx: 1, sy: 1, lean: 0, s: [flat, flat, flat, flat], curl: 0, speed: 0, impact: 0, spark: 0 };
}

/** Slab-space parts for a face (slot, wink, o), straight from peg.build(). */
function localParts(p: PegPose) {
  const items = build(neutral(p));
  const b = bounds(items.filter(i => i.id === "sheet-0"));
  const centre = move(-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
  const get = (id: string) => place(items.find(i => i.id === id)!.shape, centre);
  return K.map(k => ({
    sheet: get(`sheet-${k}`),
    punch: [`slot-l-${k}`, `hole-${k}`, `slot-r-${k}`].map(id => ({ id, shape: get(id) })),
  }));
}

/** Slab-space -> world, composed exactly as peg.build() composes it. */
export function slabMatrices(p: PegPose, sheets: Shape[]): Mat[] {
  const body = chain(size(p.sx, p.sy), lean(p.lean), turn(p.rot), move(p.x, 0));
  const pre = K.map(k => {
    const s = p.s[k];
    return chain(size(s.sx, 1), shear(s.tip), size(s.sc), turn(s.rot, 0, PIVOT_Y * s.sc), move(s.dx, s.dy), body);
  });
  const floor = bounds(K.filter(k => p.s[k].a > 0.5).map(k => ({ id: "", role: "", shape: place(sheets[k], pre[k]) }))).y1;
  return pre.map(m => chain(m, move(0, -floor - p.lift)));
}

/** World light expressed in a slab's own space (inverse of the linear part). */
function lightIn(m: Mat, [lx, ly]: Pt): Pt {
  const det = m[0] * m[3] - m[1] * m[2];
  return [(m[3] * lx - m[2] * ly) / det, (-m[1] * lx + m[0] * ly) / det];
}

// Sheet outlines never change, so their wobble is computed once.
const restParts = localParts(poses.rest);
const sheetLocal = restParts.map(p => p.sheet);
const sheetWobbled = K.map(k => wobble(sheetLocal[k], hash(`sheet-${k}`), material.jitter));
// Keep the round punch's sampled outline stable while its expression grows.
const holeLocal = restParts.map(p => {
  const hole = p.punch[1];
  if (hole.shape.k !== "circle") throw new Error("Neutral round punch must be a circle");
  return { circle: hole.shape, outline: wobble(hole.shape, hash(hole.id), material.jitter) };
});
function punchOutline(k: number, p: { id: string; shape: Shape }): Shape {
  if (!p.id.startsWith("hole-")) return wobble(p.shape, hash(p.id), material.jitter);
  if (p.shape.k !== "circle") throw new Error("Round punch must remain circular in slab space");
  const base = holeLocal[k];
  const ratio = p.shape.r / base.circle.r;
  return place(base.outline, chain(
    move(-base.circle.c[0], -base.circle.c[1]),
    size(ratio),
    move(p.shape.c[0], p.shape.c[1]),
  ));
}

/** Hand-placed thumb dents per slab, slab space: [x, y, rx, ry, depth]. Kept off the face. */
const dents: [number, number, number, number, number][][] = [
  [[-36, 24, 17, 12, 1], [30, 28, 13, 10, 0.8], [46, -4, 9, 12, 0.6], [-50, -32, 9, 8, 0.5]],
  [[-30, 18, 15, 12, 1], [34, 22, 14, 10, 0.7], [44, -30, 10, 9, 0.7]],
  [[-40, 14, 14, 13, 0.9], [22, 30, 16, 9, 0.8], [40, -20, 11, 10, 0.6]],
  [[-34, 26, 16, 11, 1], [38, 16, 12, 12, 0.8], [30, -34, 12, 8, 0.6]],
];

// ── the frame ───────────────────────────────────────────────────────────

export type Dyn = [id: string, attr: string, value: string][];
export type Frame = { svg: string; dyn: Dyn };
/** Peg alone. `defs` go in the host's <defs>; `body` goes where Peg stands (y = 0 is the floor). */
export type Character = { defs: string; body: string; dyn: Dyn };
export type CharacterOptions = {
  /** Prefix for every id, so several Pegs can share one document. */
  uid?: string;
  /** The world's two colours. Defaults to the study's studio. */
  place?: Place;
  /** Spark ticks drawn along [from, to] of their length, 0..1. A number n means [0, n]. Default 0: hidden. */
  spark?: number | readonly [number, number];
};

export function drawCharacter(pose: PegPose, opts: CharacterOptions = {}): Character {
  const uid = opts.uid ?? "pm";
  const lent = opts.place ?? studio;
  const M = material;
  const [lx, ly] = M.light;
  const along = (d: number) => `translate(${n(lx * d)} ${n(ly * d)})`;
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  const use = (name: string, attrs = "") => `<use href="#${id(name)}"${attrs ? " " + attrs : ""}/>`;
  const dyn: Dyn = [];
  /** A moving attribute: written into the markup and recorded for the player. */
  const live = (name: string, attr: string, value: string) => {
    dyn.push([id(name), attr, value]);
    return `id="${id(name)}" ${attr}="${value}"`;
  };
  const live2 = (name: string, a: [string, string], b: [string, string]) => {
    dyn.push([id(name), a[0], a[1]], [id(name), b[0], b[1]]);
    return `id="${id(name)}" ${a[0]}="${a[1]}" ${b[0]}="${b[1]}"`;
  };

  const parts = localParts(pose);
  const world = slabMatrices(pose, sheetLocal);
  const placed = build({ ...pose, spark: 1 });

  const defs: string[] = [];
  const body: string[] = [];
  // Each filter covers only its own element plus a margin (percent of that
  // element's box). Full-frame regions made every blur cost a whole frame.
  const region = ([px, py]: [number, number]) =>
    `x="${-px}%" y="${-py}%" width="${100 + 2 * px}%" height="${100 + 2 * py}%" color-interpolation-filters="sRGB"`;
  const made = new Set<string>();
  const once = (name: string, markup: () => string) => {
    if (!made.has(name)) {
      made.add(name);
      defs.push(markup());
    }
    return `filter="${ref(name)}"`;
  };
  const blur = (s: number, pad: [number, number]) => {
    const name = `blur-${Math.round(s * 10)}-${pad[0]}-${pad[1]}`;
    return once(name, () => `<filter id="${id(name)}" ${region(pad)}><feGaussianBlur stdDeviation="${n(s)}"/></filter>`);
  };
  // Tooth: a small tile of soft relief, lit from the top-left, baked at build time.
  defs.push(`<pattern id="${id("tooth")}" patternUnits="userSpaceOnUse" width="48" height="48"><image href="${TOOTH_PNG}" width="48" height="48" preserveAspectRatio="none"/></pattern>`);

  // ── geometry in <defs>; world paths move every frame ──────────────────
  for (const k of K) {
    const face = place(sheetWobbled[k], world[k]);
    const sweep = [1, 2, 3].map(i => pathD(place(face, move(0, (M.depth * i) / 3)))).join("");
    const punch = parts[k].punch.map(p => place(punchOutline(k, p), world[k]));
    defs.push(`<path ${live(`face-${k}`, "d", pathD(face))}/>`);
    defs.push(`<path ${live(`wall-${k}`, "d", sweep)}/>`);
    defs.push(`<g id="${id(`body-${k}`)}">${use(`face-${k}`)}${use(`wall-${k}`)}</g>`);
    defs.push(`<path ${live(`punch-${k}`, "d", punch.map(pathD).join(""))}/>`);
    defs.push(`<clipPath id="${id(`on-body-${k}`)}">${use(`face-${k}`)}${use(`wall-${k}`)}</clipPath>`);
    defs.push(`<clipPath id="${id(`on-face-${k}`)}"><path d="${pathD(sheetWobbled[k])}"/></clipPath>`);
    if (k < 3) defs.push(`<clipPath id="${id(`behind-${k}`)}">${K.filter(j => j > k).map(j => use(`face-${j}`) + use(`wall-${j}`)).join("")}</clipPath>`);

    const [from, to] = palette(k);
    defs.push(`<linearGradient id="${id(`lit-${k}`)}" x1="12%" y1="0%" x2="88%" y2="100%"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient>`);
    defs.push(`<linearGradient id="${id(`side-${k}`)}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${tint(to, M.deep, 0.42)}"/><stop offset="100%" stop-color="${tint(to, M.deep, 0.54)}"/></linearGradient>`);
    const dark = tint(to, M.deep, 0.38);
    const glow = tint(from, "#ffffff", 0.55);
    defs.push(`<radialGradient id="${id(`dent-dark-${k}`)}"><stop offset="0%" stop-color="${dark}" stop-opacity="0.5"/><stop offset="55%" stop-color="${dark}" stop-opacity="0.22"/><stop offset="100%" stop-color="${dark}" stop-opacity="0"/></radialGradient>`);
    defs.push(`<radialGradient id="${id(`dent-lit-${k}`)}"><stop offset="0%" stop-color="${glow}" stop-opacity="0.65"/><stop offset="55%" stop-color="${glow}" stop-opacity="0.28"/><stop offset="100%" stop-color="${glow}" stop-opacity="0"/></radialGradient>`);
  }

  // ── floor ─────────────────────────────────────────────────────────────
  const ground = placed.find(i => i.role === "shadow")!;
  {
    const pts = flatten(ground.shape, 2);
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    const op = ground.opacity ?? 1;
    const color = lent.shadow;
    const all = K.map(k => use(`body-${k}`)).join("");
    defs.push(`<linearGradient id="${id("floor-fade")}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(-M.depth * 2.4)}" x2="0" y2="${n(-M.depth * 0.2)}"><stop offset="0%" stop-color="#000000"/><stop offset="100%" stop-color="#ffffff"/></linearGradient>`);
    defs.push(`<mask id="${id("floor")}" maskUnits="userSpaceOnUse" x="${VIEW.x - 40}" y="${VIEW.y}" width="${VIEW.w + 80}" height="${VIEW.h}"><rect x="${VIEW.x - 40}" y="${VIEW.y}" width="${VIEW.w + 80}" height="${VIEW.h}" fill="${ref("floor-fade")}"/></mask>`);
    body.push(
      `<g id="${id("ground")}">` +
      `<path ${live2("pool", ["d", pathD(place(ground.shape, size(1.2, 1.55, cx, cy)))], ["opacity", n(op * 0.6)])} transform="${along(9)}" fill="${color}" ${blur(6, [16, 90])}/>` +
      `<path ${live2("core", ["d", pathD(place(ground.shape, size(0.92, 0.8, cx, cy)))], ["opacity", n(op * 0.55)])} transform="${along(3)}" fill="${tint(color, M.deep, 0.3)}" ${blur(2.6, [10, 90])}/>` +
      `<g mask="${ref("floor")}"><g transform="${along(2.4)}" fill="${tint(color, M.deep, 0.62)}" opacity="0.5" ${blur(1.6, [5, 8])}>${all}</g></g>` +
      `</g>`,
    );
  }

  // ── slabs, back to front ──────────────────────────────────────────────
  for (const k of [...K].reverse()) {
    const [from, to] = palette(k);
    const side = tint(to, M.deep, 0.42);
    const core = tint(to, M.deep, 0.7);
    const glow = tint(from, "#ffffff", 0.6);
    const hole = skin.palette.hole as string;
    const out: string[] = [];

    // Each job below is ONE filter per slab: the layers of sculpt.ts merged
    // into a single pass, so a frame costs 4 filters per slab, not 11.
    const off = (d: number, from: string, result: string) =>
      `<feOffset in="${from}" dx="${n(lx * d)}" dy="${n(ly * d)}" result="${result}"/>`;
    /**
     * The same crescent from an alpha that is already blurred. Blur and shift
     * commute, so crescents with the same softness share one blur and differ
     * only in offset: two blurs per face instead of four.
     */
    const crescentOf = (blurred: string, d: number, color: string, alpha: number, result: string) =>
      off(d, blurred, `${result}-m`) +
      `<feComposite in="all" in2="${result}-m" operator="out" result="${result}-u"/>` +
      `<feFlood flood-color="${color}" flood-opacity="${alpha}" result="${result}-c"/>` +
      `<feComposite in="${result}-c" in2="${result}-u" operator="in" result="${result}"/>`;
    /** The shape itself, pushed along the light, blurred and coloured. */
    const smear = (d: number, soft: number, color: string, alpha: number, result: string) =>
      off(d, "SourceAlpha", `${result}-m`) +
      `<feGaussianBlur in="${result}-m" stdDeviation="${n(soft)}" result="${result}-b"/>` +
      `<feFlood flood-color="${color}" flood-opacity="${alpha}" result="${result}-c"/>` +
      `<feComposite in="${result}-c" in2="${result}-b" operator="in" result="${result}"/>`;
    const filter = (name: string, pad: [number, number], body: string) => {
      defs.push(`<filter id="${id(name)}" ${region(pad)}>${body}</filter>`);
      return `filter="${ref(name)}"`;
    };

    // Contact: this slab's soft and tight shadow on the slabs behind it.
    if (k < 3) {
      const [softD, softB, softO] = M.cast.soft;
      const [tightD, tightB, tightO] = M.cast.tight;
      const f = filter(`paint-cast-${k}`, [14, 18],
        smear(softD, softB, M.deep, softO, "s") + smear(tightD, tightB, M.deep, tightO, "t") +
        `<feMerge><feMergeNode in="s"/><feMergeNode in="t"/></feMerge>`);
      out.push(`<g clip-path="${ref(`behind-${k}`)}">${use(`body-${k}`, f)}</g>`);
    }

    // Thickness: wall, darkest where it turns under, a little floor bounce.
    out.push(
      use(`wall-${k}`, `fill="${ref(`side-${k}`)}"`) +
      `<g clip-path="${ref(`on-body-${k}`)}">` +
      use(`face-${k}`, `transform="translate(0 ${n(M.depth)})" fill="none" stroke="${core}" stroke-width="${n(M.depth * 0.85)}" opacity="0.7" ${blur(1.5, [10, 13])}`) +
      use(`face-${k}`, `transform="translate(0 ${n(M.depth + 0.5)})" fill="none" stroke="${tint(to, "#fff1d8", 0.3)}" stroke-width="1.2" opacity="0.16"`) +
      `</g>`,
    );

    // Face and rolled edge, world-lit: shade on the two edges away from the
    // lamp, light on the two toward it.
    out.push(use(`face-${k}`, `fill="${ref(`lit-${k}`)}" ` + filter(`paint-face-${k}`, [12, 14],
      `<feFlood flood-color="#000000" result="all"/>` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(M.roll * 0.95)}" result="wide"/>` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(M.roll * 0.4)}" result="tight"/>` +
      crescentOf("wide", -M.roll * 2.6, side, 0.46, "r1") +
      crescentOf("tight", -M.roll * 0.95, side, 0.66, "r2") +
      crescentOf("wide", M.roll * 1.5, glow, 0.62, "r3") +
      crescentOf("tight", M.roll * 0.5, "#ffffff", 0.3, "r4") +
      `<feMerge result="stack"><feMergeNode in="SourceGraphic"/><feMergeNode in="r1"/><feMergeNode in="r2"/><feMergeNode in="r3"/><feMergeNode in="r4"/></feMerge>` +
      `<feComposite in="stack" in2="SourceAlpha" operator="in"/>`)));

    // Surface, in slab space: it rides the slab. Dent shading aims at the world light.
    const l = lightIn(world[k], M.light);
    const shift = 3;
    const dentMarks = dents[k].map(([x, y, rx, ry, depth], i) =>
      `<ellipse ${live2(`dd-${k}-${i}`, ["cx", n(x - l[0] * shift * depth)], ["cy", n(y - l[1] * shift * depth)])} rx="${rx}" ry="${ry}" fill="${ref(`dent-dark-${k}`)}" opacity="${n(depth)}"/>` +
      `<ellipse ${live2(`dl-${k}-${i}`, ["cx", n(x + l[0] * shift * depth)], ["cy", n(y + l[1] * shift * depth)])} rx="${rx}" ry="${ry}" fill="${ref(`dent-lit-${k}`)}" opacity="${n(depth)}"/>`).join("");
    const seed = hash(`tooth-${k}`);
    out.push(
      `<g ${live(`skin-${k}`, "transform", mat(world[k]))} clip-path="${ref(`on-face-${k}`)}">` +
      `<g opacity="${M.dent}">${dentMarks}</g>` +
      `<rect x="-116" y="-100" width="232" height="200" fill="${ref("tooth")}" opacity="${M.tooth}" transform="translate(${seed % 48} ${(seed >>> 8) % 48})" />` +
      `</g>`,
    );

    // Punch: rounded rim (shade up-light, light down-light), the hole, and the
    // far wall inside it catching the lamp. One filter.
    const far = tint(side, hole, 0.3);
    const rim = filter(`paint-punch-${k}`, [10, 30],
      `<feGaussianBlur in="SourceAlpha" stdDeviation="1" result="soft"/>` +
      `<feFlood flood-color="#000000" result="all"/>` +
      off(-1.9, "soft", "dm") + `<feFlood flood-color="${core}" flood-opacity="0.5"/><feComposite in2="dm" operator="in" result="d"/>` +
      off(2.3, "soft", "lm") + `<feFlood flood-color="${glow}" flood-opacity="0.9"/><feComposite in2="lm" operator="in" result="l"/>` +
      crescentOf("soft", -2.2, far, 0.6, "w") +
      `<feComposite in="w" in2="SourceAlpha" operator="in" result="wall"/>` +
      `<feMerge><feMergeNode in="d"/><feMergeNode in="l"/><feMergeNode in="SourceGraphic"/><feMergeNode in="wall"/></feMerge>`);
    out.push(use(`punch-${k}`, `fill="${hole}" ${rim}`));
    body.push(`<g>${out.join("")}</g>`);
  }

  // ── spark: the world's action lines, drawn on and off ─────────────────
  const [a, b] = typeof opts.spark === "number" ? [0, opts.spark] : (opts.spark ?? [0, 0]);
  const ticks = placed.filter(i => i.id.startsWith("spark-"));
  ticks.forEach((tick, i) => {
    const [p0, p1] = tick.shape.k === "poly" ? tick.shape.pts : [[0, 0], [0, 0]] as Pt[];
    const at = (u: number): Pt => [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
    const [s0, s1] = [at(a), at(Math.max(a, b))];
    const visible = b - a > 0.01;
    body.push(`<path ${live2(`spark-${i}`, ["d", `M${n(s0[0])} ${n(s0[1])}L${n(s1[0])} ${n(s1[1])}`], ["opacity", visible ? "1" : "0"])} fill="none" stroke="${lent.fx}" stroke-width="${n(tick.line ?? 3.2)}" stroke-linecap="round"/>`);
  });

  return { defs: defs.join(""), body: body.join(""), dyn };
}

/** The motion study's frame: Peg in the studio, on the study's clock, cropped. */
export function frame(t: number, uid = "pm", pose: PegPose = poseAt(t)): Frame {
  const c = drawCharacter(pose, { uid, place: studio, spark: sparkAt(t) });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Peg, a stack of four soft clay slabs with a punched face, performs a card-fan trick">` +
    `<defs>${c.defs}</defs><rect x="-400" y="-400" width="800" height="800" fill="${stage}"/>${c.body}</svg>`;
  return { svg, dyn: c.dyn };
}

/** The art box crop: wider than tall, room for the fan and its spark. */
export const VIEWBOX = "-140 -184 280 214";

import { TOOTH_PNG } from "./tooth";
