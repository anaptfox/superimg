import { circle, ellipse, hash, pathD, wobble } from "./kit";
import type { Shape } from "./kit";
import type { Dyn } from "./clay";
import { material } from "./clay";
import { picture } from "./card";
import type { DirectorFactory } from "./clock";
import { DURATION } from "./trick";

const FPS = 60;

/** The story, then the moves inside it. Seconds, on the trick's clock. Nudge the windows here. */
export const plan = {
  acts: {
    still: [0, 2.2],          // hills and sky only: what the slab shows as it turns over and lands
    play: [2.2, 3.91],        // the sun is out, hopping
    dusk: [3.91, 4.25],       // it hops off and drops behind the hills
    dark: [4.25, DURATION],   // hills only again, before the slab turns back
  },
  cues: {
    pop: [2.2, 2.62],         // out from behind the hills, onto the yellow one
    landA: [2.62, 2.75],      // it goes flat on the hilltop, and springs back
    hopLeft: [2.73, 3.21],    // yellow hill -> blue hill
    landB: [3.21, 3.34],
    hopRight: [3.32, 3.8],    // blue hill -> yellow hill
    landC: [3.8, 3.93],
    sink: [3.91, 4.25],       // a last small hop, and down behind the hills
  },
} as const;

/** The amounts. Tile space: +x right, +y down, the tile is 112 x 80 about (0, 0). */
export const look = {
  /** Where the sun lands on each hilltop. */
  perch: { right: 32, left: -32 },
  /** How far it sinks into the hilltop it sits on. */
  settle: 1.5,
  /** Where it waits out of sight: behind the dip between the hills. */
  hide: { x: 2, y: picture.sun.down },
  /** How high each move rises above a straight line between its two ends. */
  rise: { pop: 37, hop: 21, sink: 9 },
  /** How flat it goes on landing (0.16 = 16% shorter), and how much of that it gains in width. */
  squash: 0.16,
  widen: 0.8,
};

type Cue = keyof typeof plan.cues | keyof typeof plan.acts;
type Hill = { x: number; y: number; rx: number; ry: number };

/** The top of one hill at x, or nothing where the hill is not. */
const top = (h: Hill, x: number) => {
  const u = (x - h.x) / h.rx;
  return Math.abs(u) >= 1 ? Infinity : h.y - h.ry * Math.sqrt(1 - u * u);
};
/** The skyline: the higher of the two hills at x. */
export const ridge = (x: number) => Math.min(top(picture.far, x), top(picture.near, x));
/** Where the sun's centre rests when it sits on the skyline at x. */
export const perchAt = (x: number) => ({ x, y: ridge(x) - picture.sun.r + look.settle });

export type Scene = {
  /** The sun's centre, and its squash (1, 1 is round). It is squashed about its foot. */
  sun: { x: number; y: number; sx: number; sy: number };
  /** True from the instant the sun starts out until it is back behind the hills. */
  out: boolean;
  act: string;
};

/** The part of the clock in which the scene does anything. It starts and ends on the same picture, so it loops. */
export const span = { from: plan.acts.play[0], to: plan.acts.dusk[1] };

const wrap = (t: number) => ((t % DURATION) + DURATION) % DURATION;

export function sceneAt(seconds: number, createDirector: DirectorFactory): Scene {
  const L = look;
  const t = wrap(seconds);
  const d = createDirector(
    { timeline: { frame: Math.round(t * FPS), fps: FPS, progress: t / DURATION, seconds: t, durationSeconds: DURATION, totalFrames: DURATION * FPS } },
    plan,
  );
  /** 0 -> 1 across a cue at a steady rate: thrown things travel sideways evenly. */
  const go = (cue: Cue) => d.span(cue, { ease: "linear" });
  /** 0 -> 1 -> 0 across a cue. */
  const bell = (cue: Cue) => d.tween(0, 1, { during: cue, pattern: "sine" });

  // The moves run one after another, so adding each one's travel walks the
  // sun along: hidden -> yellow hill -> blue hill -> yellow hill -> hidden.
  const [right, left, hide] = [perchAt(L.perch.right), perchAt(L.perch.left), L.hide];
  const x = hide.x
    + (right.x - hide.x) * go("pop")
    + (left.x - right.x) * go("hopLeft")
    + (right.x - left.x) * go("hopRight")
    + (hide.x - right.x) * go("sink");
  const line = hide.y
    + (right.y - hide.y) * go("pop")
    + (left.y - right.y) * go("hopLeft")
    + (right.y - left.y) * go("hopRight")
    + (hide.y - right.y) * d.span("sink", { ease: "inQuad" });
  const arc = L.rise.pop * bell("pop") + L.rise.hop * (bell("hopLeft") + bell("hopRight")) + L.rise.sink * bell("sink");
  const flat = L.squash * (bell("landA") + bell("landB") + bell("landC"));

  return {
    sun: { x, y: line - arc, sx: 1 + flat * L.widen, sy: 1 - flat },
    out: d.inSpan(["pop", "sink"]),
    act: d.active,
  };
}

/** The sun's outline in tile space at a moment, squash included. For checks. */
export function sunOutline(s: Scene["sun"], steps = 32): [number, number][] {
  const r = picture.sun.r;
  return Array.from({ length: steps }, (_, i): [number, number] => {
    const a = (i / steps) * Math.PI * 2;
    return [s.x + Math.cos(a) * r * s.sx, s.y + r - r * s.sy + Math.sin(a) * r * s.sy];
  });
}

export type SceneOptions = {
  /** Names an element: must give ids that are unique in the host document. */
  id: (name: string) => string;
  /** Fill for each piece (a colour or a `url(#…)` paint). */
  paint: { sun: string; far: string; near: string };
  /** A filter for the pieces' small drop shadow, or nothing. */
  lift?: string;
};

/** The same hand that cut the accepted picture: same seeds, same jitter. */
const made = (shape: Shape, name: string) => pathD(wobble(shape, hash(name), material.jitter));
const num = (v: number) => String(Math.round(v * 10000) / 10000 + 0);

/** Sun, then the far hill, then the near one, so the sun is always behind the skyline. */
export function drawScene(s: Scene, o: SceneOptions): { body: string; dyn: Dyn } {
  const P = picture;
  const r = P.sun.r;
  const piece = (name: keyof SceneOptions["paint"], d: string) => `<path d="${d}" fill="${o.paint[name]}"${o.lift ? ` filter="${o.lift}"` : ""}/>`;
  // Squashed about its foot, so the foot stays on the hill.
  const move = `matrix(${num(s.sun.sx)} 0 0 ${num(s.sun.sy)} ${num(s.sun.x)} ${num(s.sun.y + r - r * s.sun.sy)})`;
  const body =
    `<g id="${o.id("sun")}" transform="${move}">${piece("sun", made(circle(0, 0, r), "pic-sun"))}</g>` +
    piece("far", made(ellipse(P.far.x, P.far.y, P.far.rx, P.far.ry, 28), "pic-far")) +
    piece("near", made(ellipse(P.near.x, P.near.y, P.near.rx, P.near.ry, 28), "pic-near"));
  return { body, dyn: [[o.id("sun"), "transform", move]] };
}
