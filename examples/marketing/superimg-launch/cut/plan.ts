// The launch film's timing: one director plan, acts and cues in seconds.
//
//   reuse    0 – 9 s   film → held frame → poster → website (the accepted opening)
//   finish             Peg finishes its card trick on the website
//   batch              two entries, each printed as a poster, a social card and a banner
//   revise             the source Peg lifts out; the published prints stay as they are
//   ability            the new trick: gather, deal the blue slab, present it
//   world              the slab's hills grow into the surroundings
//   held               the sun freezes at the poster's printed instant
//   poster             the richer film is printed as a 4:5 poster
//   website            the poster becomes the website again
//   close              the campaign kit returns under "Media as code."
//
// Section lengths are knobs; every boundary after the opening is derived from
// them and from Peg's own performances. Cue names avoid a trailing "s" (the
// director reads "…s" as a time).

import { DURATION as FAN_END } from "../peg/motion";
import { span as sceneSpan } from "../peg/scene";

/** Peg reaches the card trick's show pose here, and the film's time freezes. */
export const SHOW = 2.4;
/** Peg's card-fan moment the first entry prints (the quiet blink). */
export const KIT_POSE = 0.47;
/** Where the card-fan Peg hands over to the new trick (both draw the same Peg here). */
export const HANDOFF_POSE = 0.62;
/** The trick holds here while the slab is out: after the wink, before Peg looks away. */
export const TRICK_HOLD = 3.97;
/** The poster's frozen instant on the miniature: the top of the sun's first hop. */
export const POSTER_SCENE_AT = 2.97;

/** The accepted opening, as cue windows in film seconds. */
const opening = {
  clock: [3.1, 3.4],        // drawing number, ring and trace erase
  guide0: [3.22, 3.45],     // the blue guides lift off one group after another
  guide1: [3.29, 3.52],
  guide2: [3.36, 3.59],
  guide3: [3.43, 3.66],
  floor: [3.45, 3.8],
  camOut: [3.1, 4.65],      // gate weave and flicker settle
  toPoster: [3.4, 4.65],    // the 4:3 gate becomes the 4:5 print
  stock: [3.45, 4.45],      // paper → dark poster stock
  pool: [3.85, 4.75],
  ruleIn: [4.25, 4.75],
  headA: [4.4, 4.9],
  headB: [4.5, 5.0],
  small: [4.65, 5.05],      // masthead name and foot line
  headOut: [6.7, 7.1],
  footRuleOut: [6.7, 7.0],
  toSite: [6.8, 7.9],       // the print becomes the website's stage
  retype: [6.85, 7.85],     // name → nav wordmark, foot line → body copy
  eyebrow: [7.35, 7.75],
  heading: [7.45, 8.0],
  lightUp: [8.0, 8.4],
  controlIn: [8.4, 8.85],
} as const;
const OPENING_END = 9;

/** Section lengths after the opening. Holds are for reading. */
export const knobs = {
  finish: FAN_END - SHOW, // Peg completes the card trick on the website (wink, settle, rest)
  toKit: 1.4,
  kitHold: 2.4,
  toBoth: 1.4,
  bothHold: 1.8,
  liftOut: 1.3,
  worldMin: 2.6,          // at least this long with the trick held before the freeze
  held: 0.55,
  posterAct: 3.2,
  websiteAct: 2.5,
  closeAct: 2.1,
};

const loopLen = sceneSpan.to - sceneSpan.from;
/** Seconds of held scene time until the miniature next shows `target`, at least `min` away. */
function untilSceneAt(from: number, target: number, min: number) {
  let dt = (((target - from) % loopLen) + loopLen) % loopLen;
  while (dt < min) dt += loopLen;
  return dt;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const t0 = OPENING_END;
const tFinish = r2(t0 + knobs.finish);
const tBatch = tFinish;
const tBoth = r2(tBatch + knobs.toKit + knobs.kitHold);
const tRevise = r2(tBoth + knobs.toBoth + knobs.bothHold);
const tAbility = r2(tRevise + knobs.liftOut);
const tWorld = r2(tAbility + (TRICK_HOLD - HANDOFF_POSE));
const tFreeze = r2(tWorld + untilSceneAt(TRICK_HOLD, POSTER_SCENE_AT, knobs.worldMin));
const tPoster = r2(tFreeze + knobs.held);
const tSite = r2(tPoster + knobs.posterAct);
const tClose = r2(tSite + knobs.websiteAct);
export const END = r2(tClose + knobs.closeAct);

type W = readonly [number, number];
const w = (a: number, b: number): W => [a, b];

export const plan = {
  acts: {
    reuse: w(0, t0),
    finish: w(t0, tFinish),
    batch: w(tBatch, tRevise),
    revise: w(tRevise, tAbility),
    ability: w(tAbility, tWorld),
    world: w(tWorld, tFreeze),
    held: w(tFreeze, tPoster),
    poster: w(tPoster, tSite),
    website: w(tSite, tClose),
    close: w(tClose, END),
  },
  cues: {
    ...opening,
    // the opening website finishes; the page moves on
    controlOut: w(t0, t0 + 0.35),
    siteTypeOut: w(tBatch, tBatch + 0.45),
    lightDown: w(tBatch, tBatch + 0.6),
    // the stage card becomes the first print, then its kit is printed
    toPrint: w(tBatch + 0.1, tBatch + 1.2),
    printPoster: w(tBatch + 0.95, tBatch + 1.45),
    printSquare: w(tBatch + 1.3, tBatch + 1.8),
    printBanner: w(tBatch + 1.55, tBatch + 2.05),
    // the second entry, printed beside the first
    toOverview: w(tBoth, tBoth + 0.8),
    printPoster2: w(tBoth + 0.45, tBoth + 0.95),
    printSquare2: w(tBoth + 0.65, tBoth + 1.15),
    printBanner2: w(tBoth + 0.85, tBoth + 1.35),
    // the source lifts out of its print; the published prints stay as they are
    lift: w(tRevise, tRevise + knobs.liftOut),
    kitAway: w(tRevise + 0.05, tRevise + 0.6),
    studioIn: w(tRevise + 0.4, tRevise + 1.05),
    // richer world: the slab's hills grow out into the surroundings
    sky: w(tWorld - 0.3, tWorld + 0.35),
    farHill: w(tWorld - 0.15, tWorld + 0.8),
    midHill: w(tWorld + 0.05, tWorld + 1.0),
    foreground: w(tWorld + 0.8, tWorld + 1.3),
    // film → print
    toPoster2: w(tPoster, tPoster + 1.1),
    worldOut: w(tPoster + 0.1, tPoster + 0.65),
    posterIn: w(tPoster + 0.55, tPoster + 1.2),
    dotIn: w(tPoster + 1.05, tPoster + 1.4),
    // print → website
    toSite2: w(tSite, tSite + 1.1),
    posterOut: w(tSite, tSite + 0.45),
    skyUp: w(tSite + 0.1, tSite + 0.9),
    landIn: w(tSite + 0.25, tSite + 0.95),
    siteType: w(tSite + 0.6, tSite + 1.2),
    // close: the website leaves; the published kit returns as an overview (laid out again, not printed again)
    siteOut: w(tClose, tClose + 0.45),
    skyDown: w(tClose, tClose + 0.5),
    kitBack: w(tClose + 0.15, tClose + 0.75),
    closeType: w(tClose + 0.4, tClose + 0.8),
  },
} as const;

export type Act = keyof typeof plan.acts;
export type Cue = keyof typeof plan.cues;
export const marks = { t0, tFinish, tBatch, tBoth, tRevise, tAbility, tWorld, tFreeze, tPoster, tSite, tClose, END };

/** The moment the website's miniature hops again (the poster's frozen sun lets go). */
export const RESUME_AT = plan.cues.toSite2[1];

/** The miniature's own loop: it starts and ends on the same picture. */
export function advanceScene(s: number, dt: number): number {
  return sceneSpan.from + ((((s - sceneSpan.from + dt) % loopLen) + loopLen) % loopLen);
}

/** Which Peg performs at film time t: "fan" (the card trick) or "trick" (the new ability with its slab). */
export const performer = (t: number): "fan" | "trick" => (t < tAbility ? "fan" : "trick");

type Span = (cue: Cue, ease: "linear") => number;

/** The card-fan Peg's motion time. */
export function fanTime(t: number, span: Span, lerp: (a: number, b: number, u: number) => number): number {
  if (t <= t0) return Math.min(Math.max(t, 0), SHOW);
  if (t < tFinish) return SHOW + (t - t0);
  if (t < tRevise) return KIT_POSE * span("toPrint", "linear");
  return lerp(KIT_POSE, HANDOFF_POSE, span("lift", "linear"));
}

/** The new trick's time. */
export function trickTime(t: number): number {
  if (t < tAbility) return HANDOFF_POSE;
  return Math.min(TRICK_HOLD, HANDOFF_POSE + (t - tAbility));
}

/** The miniature's clock: follows the trick, runs on its own while the trick holds, freezes in the print. */
export function sceneTime(t: number): number {
  if (t < tWorld) return trickTime(t);
  if (t < tFreeze) return advanceScene(TRICK_HOLD, t - tWorld);
  if (t < RESUME_AT) return POSTER_SCENE_AT;
  return advanceScene(POSTER_SCENE_AT, t - RESUME_AT);
}

/** Representative held frames and boundaries, for review. */
export const HOLDS = [0, SHOW, 6.5, t0, tBoth - 0.2, tRevise - 0.2, tAbility + (2.6 - HANDOFF_POSE), tFreeze - 0.3, tSite - 0.2, tClose - 0.2, END];
