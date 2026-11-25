// The opening's film sheet: Peg on an animator's punched pencil-test sheet.
//
// The sheet is authored for the frame it is shown in: its field guide, punch,
// floor line and drawing-number ring are placed from the view box, so a 16:9
// frame gets a 16:9 sheet instead of a cropped 4:3 one. The paper itself
// (gradient, fibre, grain, lamp) is opaque SVG art because it needs a colour
// matrix filter; every pencil mark is a typed vector node, grouped the way the
// opening erases them.

import { vector, type MediaChild } from "@foxworth/superimg";
import { build } from "../peg/peg";
import { pose } from "../peg/motion";
import { hash, pathD, stroke, wobble, type Pt } from "../peg/kit";
import { SHOW } from "./plan";

export const sheet = {
  paper: ["#f6efdf", "#ece2cc"] as [string, string],
  /** Seen through the punch: the dark desk under the sheet. */
  desk: "#2b231c",
  graphite: "#3b3732",
  blue: "#5e86c4",
  /** What the sheet lends Peg. */
  place: { fx: "#3b3732", shadow: "#c4b79c" },
  /** Gate weave in % of the frame, and degrees. */
  weave: 0.16,
  weaveTurn: 0.05,
  /** Exposure flicker: opacity of a warm dark veil. */
  flicker: 0.035,
  /** Drawings per second ("on twos" at 24 fps). */
  drawings: 12,
};

export type View = { x: number; y: number; w: number; h: number };
/** The sheet in drawing units for a frame of aspect `a`: floor at y = 0, Peg centred on x = 0. */
export function viewFor(a: number): View {
  const h = 345, w = Math.max(460, h * a);
  return { x: -w / 2, y: -262, w, h };
}
export const viewBox = (v: View) => ({ x: v.x, y: v.y, width: v.w, height: v.h });

const n = (v: number) => String(Math.round(v * 100) / 100);
const rnd = (seed: string) => (hash(seed) % 10007) / 10007;

// ── the arc guide follows Peg's own fan: a circle through three slab corners at the held fan ──
function circleThrough([a, b, c]: Pt[]): { c: Pt; r: number } {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const sq = (p: Pt) => p[0] * p[0] + p[1] * p[1];
  const ux = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d;
  const uy = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d;
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) };
}
const ARC = (() => {
  const items = build(pose(SHOW));
  const corners = [0, 1, 3].map(k => {
    const s = items.find(i => i.id === `sheet-${k}`)!.shape;
    if (s.k !== "poly") throw new Error("sheet must be a polygon");
    return s.pts[0];
  });
  const fit = circleThrough(corners);
  return { c: fit.c, r: fit.r + 9, span: 15 };
})();
const arcPt = (deg: number, r = ARC.r): Pt => {
  const a = (deg * Math.PI) / 180;
  return [ARC.c[0] + r * Math.sin(a), ARC.c[1] - r * Math.cos(a)];
};
function arcD(from: number, to: number, r = ARC.r): string {
  const [x0, y0] = arcPt(from, r), [x1, y1] = arcPt(to, r);
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y1)}`;
}

/** A hand line: wobbled once, drawn twice slightly apart, like going over it. */
function pencil(pts: Pt[], seed: string, color: string, width: number, opacity: number): MediaChild {
  const a = pathD(wobble(stroke(pts), hash(seed), 0.7));
  const b = pathD(wobble(stroke(pts.map(([x, y]) => [x + 0.5, y + 0.4] as Pt)), hash(seed + "'"), 0.9));
  return vector.group({ fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round" },
    vector.path({ d: a, strokeWidth: width, strokeOpacity: opacity }),
    vector.path({ d: b, strokeWidth: width * 0.6, strokeOpacity: opacity * 0.55 }));
}
const line = (a: Pt, b: Pt, seed: string, color: string, w: number, o: number) =>
  pencil([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], seed, color, w, o);

/** Single-stroke pencil numerals, 6 x 10 units. */
const DIGITS: Record<string, string> = {
  "0": "M3 0C-.8 0-.8 10 3 10C6.8 10 6.8 0 3 0",
  "1": "M1.4 2.2L3.2 0L3.2 10",
  "2": "M.5 2.6C.5.4 5.6 0 5.6 2.8C5.6 5 .6 7 .3 10L5.9 10",
  "3": "M.5 1.1C2-.3 5.5 0 5.3 2.5C5.2 4.2 3.5 4.6 2.2 4.8C4.5 4.8 5.8 6 5.6 7.6C5.4 10.3 1.5 10.4.3 9",
  "4": "M4.3 10L4.3 0L.2 7L6 7",
  "5": "M5.4.2L1 .2L.6 4.4C2 3.6 5.6 3.4 5.6 6.8C5.6 10.4 1.5 10.4.3 9",
  "6": "M5 .5C1 0 .3 4 .4 6.8C.5 10.2 5.6 10.4 5.6 6.8C5.6 3.6 1.2 3.8.5 6.2",
  "7": "M.3.3L5.8.3L2.2 10",
  "8": "M3 4.8C-.3 4 .6 0 3 .1C5.4 0 6.2 4 3 4.8C-.5 5.6 .2 10.2 3 10C5.8 10.2 6.5 5.6 3 4.8",
  "9": "M5.5 3.6C5 6.2.5 6.4.5 3.2C.5-.4 5.6-.4 5.6 3.4L5.2 10",
};
function transformPath(d: string, ox: number, oy: number, s: number): string {
  const nums = d.match(/-?\d*\.?\d+/g)!.map(Number);
  const cmds = d.match(/[MLC]/g)!;
  const arity: Record<string, number> = { M: 2, L: 2, C: 6 };
  let i = 0;
  return cmds.map(c => {
    const vals = nums.slice(i, i + arity[c]);
    i += arity[c];
    return c + vals.map((v, j) => n(j % 2 === 0 ? ox + v * s : oy + v * s)).join(" ");
  }).join("");
}
function numerals(text: string, x: number, y: number, s: number): string {
  const step = 8.2;
  return text.padStart(3, " ").split("").map((ch, i) => (ch === " " ? "" : transformPath(DIGITS[ch], x - (3 - i) * step * s, y, s))).join("") || "M0 0";
}

/** Which drawing the sheet shows at film time t (24 fps on twos: 1, 3, 5, …). */
export const drawingAt = (t: number) => String(1 + 2 * Math.floor(t * sheet.drawings + 1e-6));

/** The paper: opaque art (it needs a colour-matrix grain). */
export function paperSvg(v: View): string {
  const { x, y, w, h } = v;
  const g = sheet.graphite;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${y} ${n(w)} ${h}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>` +
    `<linearGradient id="paper" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${sheet.paper[0]}"/><stop offset="1" stop-color="${sheet.paper[1]}"/></linearGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 0 0.22 0 0 0 0.9 -0.32"/></filter>` +
    `<filter id="fibre" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 0.4 0 0 0 0 0.33 0 0 0 0 0.22 0 0 0 0.5 -0.18"/></filter>` +
    `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<radialGradient id="lamp" cx="0.3" cy="0.18" r="0.95"><stop offset="0" stop-color="#fffaf0" stop-opacity="0.55"/><stop offset="0.6" stop-color="#fffaf0" stop-opacity="0"/><stop offset="1" stop-color="#5a4630" stop-opacity="0.16"/></radialGradient>` +
    `</defs>` +
    `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${h}" fill="url(#paper)"/>` +
    `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${h}" filter="url(#fibre)"/>` +
    `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${h}" filter="url(#grain)"/>` +
    `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${h}" fill="url(#lamp)"/>` +
    `<ellipse cx="${n(x + 44)}" cy="${y + h - 30}" rx="22" ry="12" fill="${g}" opacity="0.05" filter="url(#soft)"/>` +
    `</svg>`;
}

export type SheetOpacity = { paper: number; clock: number; floor: number; guides: number[] };

/** The pencil marks at film time t, as typed vector nodes with the opening's erase opacities. */
export function marks(v: View, t: number, o: SheetOpacity): MediaChild[] {
  const { x, y, w, h } = v;
  const g = sheet.graphite, b = sheet.blue;

  // Peg-bar punch at the top edge: slot, round hole, slot. Peg's face is the same punch.
  const py = y + 20;
  const slot = (sx: number, dy: number) => vector.rect({ x: sx, y: py - 4.5 + dy, width: 34, height: 9, rx: 4.5 });
  const punch = vector.group({ opacity: o.paper },
    vector.group({ fill: sheet.desk, filter: "sheet-edge" }, slot(-62, 0), vector.circle({ cx: 0, cy: py, r: 6.4 }), slot(28, 0)),
    vector.group({ fill: "none", stroke: "#fffaf0", strokeWidth: 0.9, opacity: 0.7 }, slot(-62, 0.9), vector.circle({ cx: 0, cy: py + 0.9, r: 6.4 }), slot(28, 0.9)));

  // Field guide: corner marks and centre cross; then the arc guide and its key and spacing ticks.
  const fx0 = x + 34, fx1 = x + w - 34, fy0 = y + 44, fy1 = y + h - 26, L = 16;
  const field = ([
    [[fx0, fy0 + L], [fx0, fy0], [fx0 + L, fy0]],
    [[fx1 - L, fy0], [fx1, fy0], [fx1, fy0 + L]],
    [[fx1, fy1 - L], [fx1, fy1], [fx1 - L, fy1]],
    [[fx0 + L, fy1], [fx0, fy1], [fx0, fy1 - L]],
  ] as Pt[][]).map((pts, i) => pencil(pts, `field-${i}`, b, 1, 0.55));
  const cy = (fy0 + fy1) / 2;
  const cross = [line([-7, cy], [7, cy], "cross-h", b, 0.9, 0.5), line([0, cy - 7], [0, cy + 7], "cross-v", b, 0.9, 0.5)];
  const arc = [
    vector.path({ d: arcD(-ARC.span - 7, ARC.span + 7), fill: "none", stroke: b, strokeWidth: 1, strokeOpacity: 0.55, strokeLinecap: "round" }),
    vector.path({ d: arcD(-ARC.span - 4, ARC.span + 5, ARC.r + 0.7), fill: "none", stroke: b, strokeWidth: 0.6, strokeOpacity: 0.3, strokeLinecap: "round" }),
  ];
  const keys = [-15, -5, 5, 15];
  const tick = (deg: number, len: number, wgt: number, op: number) => line(arcPt(deg, ARC.r - len / 2), arcPt(deg, ARC.r + len / 2), `tick-${deg}`, b, wgt, op);
  const spacing: number[] = [];
  for (let i = 0; i < keys.length - 1; i++) for (const f of [0.5, 0.8]) spacing.push(keys[i] + (keys[i + 1] - keys[i]) * f);
  const ticks = [...keys.map(k => tick(k, 9, 1.1, 0.7)), ...spacing.map(k => tick(k, 5, 0.8, 0.5))];
  // The guides lift off in four groups, in drawing order: corners, cross, arc, ticks.
  const blue = [...field, ...cross, ...arc, ...ticks];
  const q = Math.ceil(blue.length / 4);
  const guides = [0, 1, 2, 3].map(i => vector.group({ opacity: o.guides[i] }, ...blue.slice(i * q, (i + 1) * q)));

  // Floor: graphite, gone over twice. The short second pass erases with the clock marks.
  const floor = vector.group({ opacity: o.floor }, line([-176, 0.6], [178, -0.4], "floor", g, 1.3, 0.62));
  const ring = pencil(Array.from({ length: 21 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 + 0.3;
    return [x + w - 82 + Math.cos(a) * 22, y + h - 50 + Math.sin(a) * 13] as Pt;
  }), "ring", g, 0.9, 0.5);

  // The trace over the arc as the fan opens, and the drawing number.
  const open = Math.max(0, Math.min(1, pose(t).s[3].rot / 15));
  const half = ARC.span * open;
  const trace = open > 0.01 ? arcD(-half, half) : undefined;
  const clock = vector.group({ opacity: o.clock },
    line([-150, 2.2], [-60, 2.6], "floor-2", g, 0.8, 0.3), ring,
    ...(trace ? [vector.path({ d: trace, fill: "none", stroke: g, strokeWidth: 1.5, strokeOpacity: 0.6, strokeLinecap: "round" })] : []),
    vector.path({ d: numerals(drawingAt(t), x + w - 69, y + h - 57, 1.25), fill: "none", stroke: g, strokeWidth: 1.15, strokeOpacity: 0.72, strokeLinecap: "round", strokeLinejoin: "round" }));

  return [
    vector.defs(vector.filter({ id: "sheet-edge", x: "-20%", y: "-60%", width: "140%", height: "220%" }, vector.gaussianBlur({ stdDeviation: 0.35 }))),
    punch, ...guides, floor, clock,
  ];
}

/** The camera at film time t: gate weave (translate %, rotate deg) and flicker. Steps per film frame. */
export function camera(t: number): { dx: number; dy: number; rot: number; veil: number } {
  const k = Math.floor(t * sheet.drawings * 2 + 1e-6);
  const r = (s: string) => rnd(`${s}-${k}`) - 0.5;
  return {
    dx: r("wx") * 2 * sheet.weave * 0.6,
    dy: r("wy") * 2 * sheet.weave,
    rot: r("wr") * 2 * sheet.weaveTurn,
    veil: sheet.flicker * (0.5 + r("fl")),
  };
}
