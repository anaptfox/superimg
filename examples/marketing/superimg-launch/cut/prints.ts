// The campaign kit: one scene, two entries, three formats each.
//
// An entry is content (words, Peg's moment, the world that lends Peg its
// colours). A format owns the arrangement, hand-placed per mood. Every print is
// a typed Vector (stock, lamp pool, floor glow, rules, type) with the one Peg
// visual standing on its floor. Copy is sample creative copy.

import { Frame, Instance, Scene, Vector, vector, type MediaChild } from "@foxworth/superimg";
import { fanSvg, PEG_BOX, svgUri } from "../peg/art";
import { peg } from "../peg/visual";
import type { Place } from "../peg/clay";
import { FONT } from "./type";

export type World = {
  stock: string;
  pool: [inner: string, outer: string];
  floor: string;
  ink: string;
  soft: string;
  rule: number;
  /** The headline's full stop: one of Peg's own slab colours. */
  accent: string;
  place: Place;
};
export type Entry = {
  id: "reuse" | "revise";
  headline: string[];
  line: string;
  when: string;
  /** A moment of the card trick (motion time). */
  moment: number;
  mood: "quiet" | "open";
  world: World;
};

export const ENTRIES: Entry[] = [
  {
    id: "reuse",
    headline: ["Again."],
    line: "One scene. A whole campaign.",
    when: "Reuse",
    moment: 0.47,
    mood: "quiet",
    world: {
      stock: "#1e1915", pool: ["#4a3a2d", "#33281f"], floor: "#5b4836",
      ink: "#f3ebda", soft: "#bfb3a0", rule: 0.35, accent: "#ff8552",
      place: { fx: "#f3ebda", shadow: "#000000" },
    },
  },
  {
    id: "revise",
    headline: ["Make it", "better."],
    line: "Revise. Publish again.",
    when: "Same core. Next release.",
    moment: 2.4,
    mood: "open",
    world: {
      stock: "#f1e8d6", pool: ["#fffaf0", "#f6efdf"], floor: "#d6c7a8",
      ink: "#231c16", soft: "#6e6153", rule: 0.3, accent: "#2e4bff",
      place: { fx: "#3b3732", shadow: "#c4b79c" },
    },
  },
];

export type Format = { id: "poster" | "square" | "banner"; w: number; h: number };
export const FORMATS: Format[] = [
  { id: "poster", w: 1080, h: 1350 },
  { id: "square", w: 1080, h: 1080 },
  { id: "banner", w: 1500, h: 500 },
];

type Slot = { x: number; y: number; size: number; anchor?: "start" | "end" };
type Arrangement = {
  mast: { y: number; size: number; rule: number; when?: number };
  peg: { x: number; floor: number; scale: number };
  pool: { cx: number; cy: number; r: number };
  head: { x: number; y: number[]; size: number; track: number };
  line: Slot;
  when?: Slot;
  foot?: number;
  margin: number;
};

/** Hand-placed arrangements, in output pixels of each format. */
export const ARRANGE: Record<Format["id"], Record<Entry["mood"], Arrangement>> = {
  poster: {
    quiet: {
      margin: 72, mast: { y: 100, size: 30, rule: 128 },
      peg: { x: 540, floor: 716, scale: 2.55 }, pool: { cx: 540, cy: 560, r: 540 },
      head: { x: 62, y: [1078], size: 248, track: -0.035 }, foot: 1166,
      line: { x: 72, y: 1240, size: 38 }, when: { x: 1008, y: 1240, size: 38, anchor: "end" },
    },
    open: {
      margin: 72, mast: { y: 100, size: 30, rule: 128 },
      peg: { x: 528, floor: 1030, scale: 2.7 }, pool: { cx: 540, cy: 800, r: 580 },
      head: { x: 64, y: [290, 420], size: 136, track: -0.03 }, foot: 1110,
      line: { x: 72, y: 1184, size: 40 }, when: { x: 72, y: 1250, size: 32 },
    },
  },
  square: {
    quiet: {
      margin: 72, mast: { y: 100, size: 30, rule: 128 },
      peg: { x: 660, floor: 900, scale: 2.25 }, pool: { cx: 660, cy: 760, r: 470 },
      head: { x: 62, y: [330], size: 214, track: -0.035 },
      line: { x: 72, y: 452, size: 40 }, when: { x: 72, y: 1008, size: 38 },
    },
    open: {
      margin: 72, mast: { y: 100, size: 30, rule: 128, when: 26 },
      peg: { x: 528, floor: 590, scale: 2.15 }, pool: { cx: 540, cy: 450, r: 470 },
      head: { x: 64, y: [770, 870], size: 104, track: -0.03 },
      line: { x: 72, y: 976, size: 40 },
    },
  },
  banner: {
    quiet: {
      margin: 56, mast: { y: 76, size: 26, rule: 100, when: 26 },
      peg: { x: 1210, floor: 436, scale: 1.42 }, pool: { cx: 1210, cy: 330, r: 340 },
      head: { x: 48, y: [312], size: 196, track: -0.035 },
      line: { x: 56, y: 438, size: 34 },
    },
    open: {
      margin: 56, mast: { y: 76, size: 26, rule: 100, when: 26 },
      peg: { x: 250, floor: 444, scale: 1.48 }, pool: { cx: 270, cy: 320, r: 360 },
      head: { x: 560, y: [238, 330], size: 96, track: -0.03 },
      line: { x: 564, y: 410, size: 34 },
    },
  },
};

export const arrangement = (e: Entry, f: Format) => ARRANGE[f.id][e.mood];

const pegArt = new Map<string, string>();
/** The print's own Peg: the card-fan Peg at the entry's moment, in the entry's lent colours. Drawn once per print. */
function printedPeg(e: Entry, f: Format): string {
  const key = `${e.id}-${f.id}`;
  let src = pegArt.get(key);
  if (!src) pegArt.set(key, (src = svgUri(fanSvg(e.moment, e.world.place, `${key}-peg`))));
  return src;
}

/** One print at `w` x `h` pixels (the format's aspect). `showPeg` false leaves the floor empty for the performing Peg. */
export function print(e: Entry, f: Format, w: number, h: number, showPeg = true): MediaChild {
  const A = arrangement(e, f);
  const W = e.world;
  const uid = `${e.id}-${f.id}`;
  const k = w / f.w;
  const m = A.margin;
  const dark = e.mood === "quiet";
  const sans = (s: Slot, body: string, fill: string, weight: number, track = 0, id?: string) =>
    vector.text({ id, x: s.x, y: s.y, size: s.size, family: FONT.sans, weight, fill, letterSpacing: track, anchor: s.anchor ?? "start" }, body);

  const head = vector.text(
    { id: `${uid}-head`, x: A.head.x, y: A.head.y[0], size: A.head.size, family: FONT.serif, weight: 500, fill: W.ink, letterSpacing: Number((A.head.size * A.head.track).toFixed(2)) },
    // Each line is a run; the last line's full stop is its own run in the accent.
    ...e.headline.flatMap((l, i) => {
      const last = i === e.headline.length - 1 && l.endsWith(".");
      return [vector.run({ x: A.head.x, y: A.head.y[i] }, last ? l.slice(0, -1) : l), ...(last ? [vector.run({ fill: W.accent }, ".")] : [])];
    }));

  const art = Vector({ id: `${uid}-art`, width: w, height: h, viewBox: { x: 0, y: 0, width: f.w, height: f.h }, fit: "fill" },
    vector.defs(
      vector.radialGradient({ id: `${uid}-pool`, gradientUnits: "userSpaceOnUse", cx: A.pool.cx, cy: A.pool.cy, r: A.pool.r },
        vector.stop({ offset: 0, stopColor: W.pool[0], stopOpacity: dark ? 0.85 : 0.95 }),
        vector.stop({ offset: 0.55, stopColor: W.pool[1], stopOpacity: dark ? 0.45 : 0.5 }),
        vector.stop({ offset: 1, stopColor: W.stock, stopOpacity: 0 })),
      vector.radialGradient({ id: `${uid}-floor`, gradientUnits: "userSpaceOnUse", cx: A.peg.x, cy: A.peg.floor, r: 130 * A.peg.scale,
        gradientTransform: `translate(0 ${A.peg.floor}) scale(1 .22) translate(0 ${-A.peg.floor})` },
        vector.stop({ offset: 0, stopColor: W.floor, stopOpacity: dark ? 0.7 : 0.55 }),
        vector.stop({ offset: 1, stopColor: W.floor, stopOpacity: 0 }))),
    vector.rect({ width: f.w, height: f.h, fill: W.stock }),
    vector.rect({ width: f.w, height: f.h, fill: `${uid}-pool` }),
    vector.ellipse({ cx: A.peg.x, cy: A.peg.floor, rx: 130 * A.peg.scale, ry: 30 * A.peg.scale, fill: `${uid}-floor` }),
    sans({ x: m, y: A.mast.y, size: A.mast.size }, "SuperImg", W.ink, 600, Number((A.mast.size * 0.06).toFixed(2)), `${uid}-mast`),
    ...(A.mast.when ? [sans({ x: f.w - m, y: A.mast.y, size: A.mast.when, anchor: "end" }, e.when, W.ink, 600, Number((A.mast.when * 0.02).toFixed(2)), `${uid}-mast-when`)] : []),
    vector.line({ x1: m, y1: A.mast.rule, x2: f.w - m, y2: A.mast.rule, stroke: W.ink, strokeOpacity: W.rule, strokeWidth: 2 }),
    head,
    ...(A.foot ? [vector.line({ x1: m, y1: A.foot, x2: f.w - m, y2: A.foot, stroke: W.ink, strokeOpacity: W.rule, strokeWidth: 2 })] : []),
    sans(A.line, e.line, W.soft, 400, 0, `${uid}-line`),
    ...(A.when ? [sans(A.when, e.when, W.ink, 600, Number((A.when.size * 0.02).toFixed(2)), `${uid}-when`)] : []),
  );

  return Frame({ id: `${uid}-print`, x: 0, y: 0, width: w, height: h, overflow: "hidden" },
    art,
    ...(showPeg ? [Scene({ id: `${uid}-stage`, width: w, height: h },
      Instance({ id: `${uid}-peg`, entityId: `print:${uid}`, of: peg, data: { src: printedPeg(e, f), box: PEG_BOX, scale: A.peg.scale * k }, at: { x: A.peg.x * k, y: A.peg.floor * k } }))] : []),
  );
}
