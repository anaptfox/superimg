import type { Mat } from "./kit";
import { bounds, chain, move, place, size, turn } from "./kit";
import type { PegPose, SheetPose } from "./peg";
import { poses } from "./peg";
import { blend, detach, sheets, worldOf } from "./slab";
import { clamp, lerp } from "./kit";
import type { DirectorFactory, Oscillate, RadToDeg } from "./clock";

export const DURATION = 6;
const FPS = 60;

/** The story, then the moves inside it. Seconds. Nudge the windows here. */
export const plan = {
  acts: {
    rest: [0, 0.8],
    gather: [0.8, 1.25],
    deal: [1.25, 2.1],
    present: [2.1, 4.0],
    recall: [4.0, 4.86],
    settle: [4.86, 5.4],
    home: [5.4, DURATION],
  },
  cues: {
    blink: [0.36, 0.58],        // "nothing to see here"
    hush: [0.8, 1.05],          // breathing stops
    tuck: [0.86, 1.22],         // the blue slab ducks behind the yellow one
    release: [1.25, 1.45],      // the squash lets go
    stretch: [1.25, 1.6],
    sidestep: [1.27, 1.7],      // Peg hops aside: the toss pushes it back
    reopen: [1.3, 1.75],        // the three slabs left open up again
    toss: [1.28, 1.86],         // the slab in the air
    oh: [1.4, 1.7],
    pegLand: [1.7, 1.95],
    slabLand: [1.86, 2.16],
    turnOver: [1.46, 1.8],      // it turns over in the air: punch side away, picture side out
    regard: [2.1, 2.5],         // leans toward what it dealt
    sunrise: [2.2, 2.85],       // the picture does something: its sun comes up
    proud: [2.9, 3.6],
    sparkOn: [2.95, 3.11],
    relax: [3.0, 3.15],         // "oh" settles into something smug
    winkShut: [3.12, 3.24],
    winkTilt: [3.12, 3.62],
    winkOpen: [3.5, 3.62],
    sparkOff: [3.82, 3.96],
    sunset: [3.98, 4.26],       // and goes down again, quicker than it came
    unregard: [4.0, 4.3],
    brace: [4.2, 4.6],          // the deck squares up to receive
    crouch: [4.22, 4.42],       // the slab dips before it jumps
    stepBack: [4.3, 4.8],
    fetch: [4.36, 4.86],        // the slab in the air, going home
    turnBack: [4.38, 4.66],     // punch side out again before it reaches the deck
    catch: [4.84, 5.1],
    spread: [4.9, 5.4],         // the deck re-spreads; blue shows again
    breathe: [5.4, 5.8],
  },
} as const;

/** The amounts. Distances are drawing units, angles degrees. */
export const amount = {
  /** Where Peg stands at rest, and where it steps to. */
  home: poses.rest.x,
  aside: -80,
  /** Where the dealt slab stands, and how it sits. */
  slabX: 84,
  slabTilt: 3,
  /** Narrowest the slab gets as it turns over: its own thickness, seen edge-on. */
  edgeOn: 0.06,
  tossHeight: 46,
  fetchHeight: 40,
  hop: 9,
  hopBack: 6,
  restStep: 8,
  gatherStep: 3,
  gatherSquash: 0.1,
  /** The wink during the show. 0 removes it. */
  wink: 1,
};

type Cue = keyof typeof plan.cues | keyof typeof plan.acts;
type Ease = "outCubic" | "inCubic" | "inOutCubic" | "inOutSine" | "outBack" | "linear";

export type Moment = {
  /** The whole pose for the shared painter. Slab 3 is detached while it is out. */
  pose: PegPose;
  /** True from the instant the slab leaves the deck until it is back. */
  out: boolean;
  /** Slab 3's world matrix. */
  slab: Mat;
  /** How far the slab is from the deck, 0..1. Its own floor shadow fades in with this. */
  away: number;
  /** How high the slab's foot is off the floor. */
  slabLift: number;
  /** True while the slab's picture side faces us. */
  faceUp: boolean;
  /** The picture's sun, 0 (down) .. 1 (up). */
  sun: number;
  /** Spark ticks, drawn [from, to] along their length. */
  spark: [number, number];
  act: string;
};

const wrap = (t: number) => ((t % DURATION) + DURATION) % DURATION;

export function moment(time: number, createDirector: DirectorFactory, oscillate: Oscillate, radToDeg: RadToDeg): Moment {
  const A = amount;
  const t = wrap(time);
  const d = createDirector(
    { timeline: { frame: Math.round(t * FPS), fps: FPS, progress: t / DURATION, seconds: t, durationSeconds: DURATION, totalFrames: DURATION * FPS } },
    plan,
  );
  /** 0 -> 1 across a cue, eased. The options form is deliberate: `d.span("toss", "outCubic")`
   *  reads a name ending in "s" as a time string ("…s") and throws. */
  const up = (cue: Cue, ease: Ease = "inOutCubic") => d.span(cue, { ease });
  /** 0 -> 1 -> 0 across a cue. */
  const bell = (cue: Cue) => d.tween(0, 1, { during: cue, pattern: "sine" });

  // ── Peg ────────────────────────────────────────────────────────────────
  const squeeze = up("gather") - up("release", "outCubic");
  const upright = up("sidestep", "outCubic") - up("spread");
  const aside = up("sidestep", "outCubic") - up("stepBack");
  const regard = up("regard") - up("unregard");
  const winkTilt = A.wink * bell("winkTilt");

  const sy = 1 - A.gatherSquash * squeeze + 0.05 * bell("stretch") - 0.035 * bell("pegLand") + 0.015 * bell("proud") - 0.045 * bell("catch");
  const sx = 1 + (1 - sy) * 0.6;
  const x = lerp(A.home, A.aside, aside);
  const lift = A.hop * bell("sidestep") + A.hopBack * bell("stepBack");
  const rot = lerp(poses.rest.rot, 0, upright) - 3 * squeeze + 2.5 * winkTilt;
  const leanDeg = -3 * squeeze + 2 * regard;

  const slot = 1 - 0.85 * bell("blink") - 0.5 * squeeze;
  const o = 1 - 0.15 * squeeze + 0.35 * up("oh", "outBack") - 0.3 * up("relax") - 0.05 * up("unregard");
  const wink = A.wink * (up("winkShut", "outCubic") - up("winkOpen", "outCubic"));

  // The deck. It squares up before the deal and again to receive the slab.
  const squared = up("gather") - up("reopen", "outBack") + up("brace") - up("spread", "outBack");
  const step = lerp(A.restStep, A.gatherStep, squared);
  const breath = oscillate(t, { period: DURATION / 2, from: -0.5, to: 0.5 }) * (1 - up("hush") + up("breathe"));
  /** Slab 3's place in the deck: 3 is the back, 2 is tucked behind the yellow slab. */
  const place3 = 3 - up("tuck") + up("spread", "outBack");
  const inDeck = (k: number, at: number): SheetPose => ({ dx: step * at, dy: -step * at - breath * k * 0.7, rot: 0, sx: 1, tip: 0, sc: 1, a: 1 });
  const stack: PegPose = {
    ...poses.rest, x, lift, rot, sx, sy, lean: leanDeg, slot, wink, o,
    s: [inDeck(0, 0), inDeck(1, 1), inDeck(2, 2), inDeck(3, place3)],
    curl: 0, speed: 0, impact: 0, spark: 0,
  };

  // ── the dealt slab ─────────────────────────────────────────────────────
  // Its flight is a blend from "tucked in the deck" (which follows Peg) to
  // "standing on its own", plus an arc. Nothing about the slab is alive: no
  // breath, no blink.
  const flight = up("toss", "inOutSine") - up("fetch", "inOutSine");
  const arc = A.tossHeight * bell("toss") + A.fetchHeight * bell("fetch");
  const out = d.inSpan(["toss", "fetch"]);
  const tucked = worldOf(stack, 3);
  const squash = 0.07 * bell("slabLand") + 0.05 * bell("crouch");
  const tilt = A.slabTilt + 3 * (1 - up("slabLand", "outCubic")) * up("toss", "linear");
  const stood = onFloor(chain(size(1 + squash * 0.6, 1 - squash, 0, 48), turn(tilt, 0, 48), move(A.slabX, 0)));
  // Turning over, drawn flat: the slab narrows to its edge and widens again.
  const turned = up("turnOver", "inOutSine") - up("turnBack", "inOutSine");
  const width = clamp(Math.abs(Math.cos(Math.PI * turned)), A.edgeOn, 1);
  const slab = out ? chain(size(width, 1), blend(tucked, stood, flight), move(0, -arc)) : tucked;
  const pose = out ? detach(stack, 3, slab, radToDeg) : stack;

  return {
    pose, out, slab,
    away: out ? flight : 0,
    slabLift: out ? Math.max(0, -bounds([{ id: "", role: "", shape: place(sheets[3], slab) }]).y1) : 0,
    faceUp: out && turned > 0.5,
    sun: up("sunrise", "outBack") - up("sunset", "inCubic"),
    spark: [up("sparkOff", "inCubic"), up("sparkOn", "outCubic")],
    act: d.active,
  };
}

/** Stand a placement on the floor (y = 0), as peg.ts stands the deck. */
function onFloor(m: Mat): Mat {
  const foot = bounds([{ id: "", role: "", shape: place(sheets[3], m) }]).y1;
  return chain(m, move(0, -foot));
}

/** Act boundaries, for the scrub bar. */
export const acts = Object.entries(plan.acts).map(([label, [at]]) => ({ label, at }));
