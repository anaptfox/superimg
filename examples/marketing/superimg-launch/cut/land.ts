// The miniature's world at full size: the blue and yellow hills that grow out
// of Peg's slab, in Peg's own inks, cut by the same hand as the slab picture.
//
// The paper planes, the printed poster's land and the website's land are
// opaque SVG art (paper tooth, drop-shadow filters). Their type is not here:
// the film sets every word as typed text over this art.
//
// Colour comes from the stdlib (`ctx.std.color`), passed in once.

import type { RenderContext } from "@foxworth/superimg";
import { at, chain, ellipse, hash, move, pathD, place, size, wobble } from "../peg/kit";
import { skin } from "../peg/peg";
import { material, stage } from "../peg/clay";
import { picture } from "../peg/card";
import { moment } from "../peg/trick";
import { plan as scenePlan, sceneAt } from "../peg/scene";
import { TOOTH_PNG } from "../peg/tooth";
import { SCENE_BOX, type Clock } from "../peg/art";
import { POSTER_SCENE_AT } from "./plan";

type Color = RenderContext["std"]["color"];
type Pt = [number, number];

const grad = (role: string) => (skin.palette[role] as { grad: [string, string] }).grad;
const n = (v: number) => String(Math.round(v * 100) / 100);

/** Where the shared scene sits in a composition: its floor point and scale. */
export type Mount = { fx: number; fy: number; s: number };
export const toComposition = (m: Mount, [x, y]: Pt): Pt => [m.fx + x * m.s, m.fy + y * m.s];

/** The film's composition (16:9), the poster (4:5) and the website's stage, in their own units. */
export const FILM = { W: 640, H: 360, mount: { fx: 320, fy: 300, s: 1.15 } as Mount, horizon: 240 };
export const POSTER = { W: 400, H: 500, mount: { fx: 200, fy: 436, s: 1.1 } as Mount, horizon: 350 };
export const STAGE = { W: 728, H: 430, mount: { fx: 506, fy: 376, s: 1.2 } as Mount, horizon: 318 };

const UNIT = 60;
const GRAIN = 0.11;
const tooth = (id: string, px = 34) =>
  `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${px}" height="${px}"><image href="${TOOTH_PNG}" width="${px}" height="${px}" preserveAspectRatio="none"/></pattern>`;

/** One hill, cut at the miniature's size with its wobble, then enlarged. `top` is its highest point. */
function hill(name: string, cx: number, top: number, rx: number, ry: number, fill: string, grain?: string): string {
  const k = rx / UNIT;
  const cut = wobble(ellipse(0, 0, UNIT, ry / k, 28), hash(`land-${name}`), material.jitter);
  const d = pathD(place(cut, chain(size(k), move(cx, top + ry))));
  return `<path d="${d}" fill="${fill}"/>` + (grain ? `<path d="${d}" fill="url(#${grain})" opacity="${GRAIN}"/>` : "");
}
/** The ground: a broad smooth rise whose top is the horizon. */
function ground(cx: number, top: number, rx: number, ry: number, fill: string, grain?: string): string {
  const d = pathD(ellipse(cx, top + ry, rx, ry, 64));
  return `<path d="${d}" fill="${fill}"/>` + (grain ? `<path d="${d}" fill="url(#${grain})" opacity="${GRAIN}"/>` : "");
}
const lift = (id: string, dy: number, blur: number, op: number, ink: string) =>
  `<filter id="${id}" x="-10%" y="-20%" width="120%" height="140%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${ink}" flood-opacity="${op}"/></filter>`;
const doc = (vb: string, body: string, align = "xMidYMid slice") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="${align}">${body}</svg>`;

export type Art = ReturnType<typeof buildArt>;

function buildArt(color: Color) {
  const ink = {
    cream: grad("sheet0")[0],
    orange: grad("sheet1")[1],
    yellow: grad("sheet2")[1],
    blue: grad("sheet3")[1],
    ground: stage,
  };
  const land = {
    sky: "#f6f1e6",
    graphite: "#2a241c",
    inkBlue: color.mix(grad("sheet3")[1], "#0e1030", 0.55),
  };
  const tint = { blue: { far: [31, 34], mid: [22, 20] }, yellow: { far: [24, 12], mid: [16, 6] } } as const;
  const aerial = (which: "blue" | "yellow", depth: "far" | "mid") => {
    const [l, d] = tint[which][depth];
    return color.desaturate(color.lighten(ink[which], l), d);
  };
  const g = land.graphite;

  // ── the film's paper planes, back to front (Peg mounts between ground and fore) ──
  const { W, H } = FILM;
  const full = `0 0 ${W} ${H}`;
  /** Hills are whole shapes: while they grow out of the slab they are drawn past the frame's edge. */
  const padded = `${-W / 2} ${-H / 2} ${W * 2} ${H * 2}`;
  const foreColor = [color.mix(ink.blue, g, 0.5), color.mix(ink.yellow, g, 0.55)];
  const fore: [number, number, number, number][] = [[-60, 412 - 104, 190, 104], [700, 418 - 100, 200, 100]];
  const planes = {
    sky: doc(full,
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.lighten(land.sky, 2.5)}"/><stop offset="1" stop-color="${land.sky}"/></linearGradient>${tooth("t")}</defs>` +
      `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#sky)"/>` +
      `<rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#t)" opacity="${GRAIN * 0.6}"/>`),
    far: doc(padded,
      `<defs>${lift("l", 1.5, 2, 0.08, g)}${tooth("t")}</defs><g filter="url(#l)">` +
      hill("far-a", 30, 132, 170, 150, aerial("yellow", "far"), "t") +
      hill("far-b", 622, 118, 180, 160, aerial("blue", "far"), "t") + `</g>`),
    mid: doc(padded,
      `<defs>${lift("l", 2.5, 3, 0.12, g)}${tooth("t")}</defs><g filter="url(#l)">` +
      hill("mid-yellow", 500, 138, 236, 170, aerial("yellow", "mid"), "t") +
      hill("mid-blue", 168, 104, 214, 190, aerial("blue", "mid"), "t") + `</g>`),
    ground: doc(full,
      `<defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ink.ground}"/><stop offset="1" stop-color="${color.mix(ink.ground, g, 0.9)}"/></linearGradient>${lift("l", -1.5, 2.5, 0.1, g)}${tooth("t")}</defs>` +
      `<g filter="url(#l)">${ground(W / 2, FILM.horizon, W * 1.5, 520, "url(#gr)", "t")}</g>`),
    fore: doc(full,
      `<defs><filter id="soft" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
      `<g filter="url(#soft)">${fore.map(([cx, top, rx, ry], i) => hill(`fore-${i}`, cx, top, rx, ry, foreColor[i])).join("")}</g>`),
  };

  // ── the printed poster: paper and sky (behind the headline), then the land (in front of it) ──
  const P = POSTER;
  const sheet = {
    paper: "#f0e9db",
    sky: color.desaturate(color.lighten(ink.blue, 38), 45),
    ink: land.inkBlue,
    dots: { every: 4.2, r: 1.1, clear: 2.5 },
  };
  const rule = (y: number) => `<rect x="26" y="${y}" width="${P.W - 52}" height="0.8" fill="${sheet.ink}" opacity="0.55"/>`;
  const posterPaper = doc(`0 0 ${P.W} ${P.H}`,
    `<defs>${tooth("t", 56)}</defs>` +
    `<rect width="${P.W}" height="${P.H}" fill="${sheet.paper}"/>` +
    `<rect width="${P.W}" height="${P.horizon + 40}" fill="${sheet.sky}"/>` +
    `<rect width="${P.W}" height="${P.H}" fill="url(#t)" opacity="${GRAIN * 0.6}"/>` + rule(48), "none");
  const posterLand = doc(`0 0 ${P.W} ${P.H}`,
    `<defs>${lift("l", 1.6, 1.8, 0.12, g)}${tooth("t", 56)}` +
    `<linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sheet.paper}"/><stop offset="1" stop-color="${color.mix(sheet.paper, g, 0.9)}"/></linearGradient></defs>` +
    `<g filter="url(#l)">` +
    hill("ps-yellow", 326, 276, 176, 150, aerial("yellow", "mid"), "t") +
    hill("ps-blue", 66, 258, 190, 180, aerial("blue", "mid"), "t") +
    ground(P.W / 2, P.horizon, P.W * 1.4, 560, "url(#gr)", "t") + `</g>` +
    rule(P.H - 30) +
    `<g fill="${ink.orange}">${[0, 1, 2, 3, 4].map(i => `<circle cx="${(28 + i * 4.2).toFixed(1)}" cy="${(P.H - 16 - Math.sin((i / 4) * Math.PI) * 3).toFixed(2)}" r="${sheet.dots.r}"/>`).join("")}</g>`, "none");

  // ── the website's land, behind its copy ──
  const S = STAGE;
  const stageLand = doc(`0 0 ${S.W} ${S.H}`,
    `<defs>${lift("l", 2, 2.5, 0.1, g)}${tooth("t")}</defs>` +
    `<rect width="${S.W}" height="${S.H}" fill="${land.sky}"/>` +
    `<rect width="${S.W}" height="${S.H}" fill="url(#t)" opacity="${GRAIN * 0.6}"/>` +
    `<g filter="url(#l)">` +
    hill("st-far", 150, 262, 280, 120, aerial("yellow", "far"), "t") +
    hill("st-yellow", 646, 190, 196, 180, aerial("yellow", "mid"), "t") +
    hill("st-blue", 424, 184, 214, 176, aerial("blue", "mid"), "t") +
    ground(S.W / 2, S.horizon, S.W * 1.5, 600, ink.ground, "t") + `</g>`, "xMidYMax slice");

  return { ink, land, sheet, planes, posterPaper, posterLand, stageLand };
}

let cached: Art | undefined;
/** The land's art, built once from the stdlib's colour functions. */
export function artFor(color: Color): Art {
  return (cached ??= buildArt(color));
}

let dots: Pt[] | undefined;
/**
 * The poster's notation: the sun's hop across its cue, carried onto the poster
 * through the slab's matrix at the frozen instant, as even dots, with the part
 * under the frozen sun left clear.
 */
export function hopDots(clock: Clock): Pt[] {
  if (dots) return dots;
  const m = moment(POSTER_SCENE_AT, clock.director, clock.oscillate, clock.radToDeg);
  const [from, to] = scenePlan.cues.hopLeft;
  const mount = POSTER.mount;
  const pts: Pt[] = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const s = sceneAt(from + ((to - from) * i) / N, clock.director).sun;
    pts.push(toComposition(mount, at(m.slab, [s.x, s.y])));
  }
  const out: Pt[] = [pts[0]];
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run >= 4.2) { out.push(pts[i]); run = 0; }
  }
  const now = sceneAt(POSTER_SCENE_AT, clock.director).sun;
  const sun = toComposition(mount, at(m.slab, [now.x, now.y]));
  const r = picture.sun.r * mount.s;
  dots = out.filter(([x, y]) => Math.hypot(x - sun[0], y - sun[1]) > r + 2.5);
  return dots;
}

export { SCENE_BOX, n };
