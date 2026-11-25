import type { Beat, Item, Pt, Shape } from "./kit";
import { bounds, capsule, chain, circle, clamp, lean, lerp, move, placeAll, poly, shadow, shear, size, stroke, ticks, turn } from "./kit";
import type { Era } from "./treat";

export type SheetPose = { dx: number; dy: number; rot: number; sx: number; tip: number; sc: number; a: number };
/** Growth is state, not performance: how many slabs it has earned so far. */
export type PegState = { slabs: number; inline?: boolean };
export type PegPose = {
  x: number; lift: number; rot: number; sx: number; sy: number; lean: number;
  s: [SheetPose, SheetPose, SheetPose, SheetPose];
  /** Slot openness. 1 is punched-normal, 0.1 is a flat line. */
  slot: number;
  /** Closes the right slot only. */
  wink: number;
  /** Size of the round hole. 1 is neutral; bigger is an "oh". */
  o: number;
  /** Corner peel on the front sheet, 0..1. */
  curl: number;
  speed: number; impact: number; spark: number;
};

const W = 128;
const H = 96;
const CLIP = 27;
const FACE_Y = -19;
/** The round hole sits a little under the slots. Less accurate, much warmer. */
const DROP = 7;
const PIVOT: Pt = [0, 118];

function sheetShape(curl: number): Shape {
  const a = 36 * curl;
  const top: Pt[] = [[-W / 2, -H / 2], [W / 2 - CLIP, -H / 2], [W / 2, -H / 2 + CLIP]];
  if (a <= 1) return poly([...top, [W / 2, H / 2], [-W / 2, H / 2]], [19, 9, 9, 19, 19]);
  return poly([...top, [W / 2, H / 2 - a], [W / 2 - a, H / 2], [-W / 2, H / 2]], [19, 9, 9, 0, 0, 19]);
}

function punch(k: number, slot: number, opacity: number, wink = 0, o = 1, drop = DROP): Item[] {
  const h = Math.max(2.6, 11 * slot);
  return [
    { id: `slot-l-${k}`, role: "hole", shape: capsule(-35, FACE_Y, 25, h), flat: true, opacity },
    { id: `hole-${k}`, role: "hole", shape: circle(0, FACE_Y + drop, 6.5 * o), flat: true, opacity },
    { id: `slot-r-${k}`, role: "hole", shape: capsule(35, FACE_Y, 25, Math.max(2.6, h * (1 - wink))), flat: true, opacity },
  ];
}

export function build(pose: PegPose, state: PegState = { slabs: 4 }): Item[] {
  const body: Item[] = [];
  for (let k = 3; k >= 0; k--) {
    const s = pose.s[k];
    if (s.a <= 0.02 || k >= state.slabs) continue;
    const front = k === 0;
    const parts: Item[] = [
      { id: `sheet-${k}`, role: `sheet${k}`, shape: sheetShape(front ? pose.curl : 0), opacity: s.a },
      ...punch(k, pose.slot, s.a, front ? pose.wink : 0, pose.o, state.inline ? 0 : DROP),
    ];
    if (front && pose.curl > 0.03) {
      const a = 36 * pose.curl;
      parts.push({ id: "flap", role: "flap", thin: true, shape: poly([[W / 2 - a, H / 2], [W / 2, H / 2 - a], [W / 2 - a, H / 2 - a]], [0, 0, 8]) });
    }
    const m = chain(size(s.sx, 1), shear(s.tip), size(s.sc), turn(s.rot, PIVOT[0], PIVOT[1] * s.sc), move(s.dx, s.dy));
    body.push(...placeAll(parts, m));
  }
  // Stand the stack on the ground, then perform the whole-body move.
  let out = placeAll(body, chain(size(pose.sx, pose.sy), lean(pose.lean), turn(pose.rot), move(pose.x, 0)));
  const floor = bounds(out.filter(i => i.id.startsWith("sheet") && (i.opacity ?? 1) > 0.5)).y1;
  out = placeAll(out, move(0, -floor - pose.lift));
  const box = bounds(out.filter(i => i.id.startsWith("sheet") && (i.opacity ?? 1) > 0.5));
  const cx = (box.x0 + box.x1) / 2;

  const fx: Item[] = [];
  if (pose.speed > 0.02) {
    const back = bounds(out.filter(i => i.id.startsWith("sheet"))).x0;
    [[-80, 22, 0], [-54, 30, 8], [-28, 18, 3]].forEach(([y, len, gap], i) => {
      fx.push({ id: `speed-${i}`, role: "fx", line: 3.2, opacity: pose.speed, shape: stroke([[back - 6 - gap - len, y - pose.lift], [back - 6 - gap, y - pose.lift]]) });
    });
  }
  fx.push(...ticks("impact-l", box.x0 - 6, -2, 188, 222, 3, 6, 20, 3.2, pose.impact));
  fx.push(...ticks("impact-r", box.x1 + 6, -2, -42, -8, 3, 6, 20, 3.2, pose.impact));
  fx.push(...ticks("spark", box.x1 - 4, box.y0 + 2, -78, -12, 3, 10, 24, 3.2, pose.spark));

  return [shadow(cx, (box.x1 - box.x0) * 0.92, pose.lift), ...out, ...fx];
}

// ── poses ──────────────────────────────────────────────────────────────────

const sheet = (dx: number, dy: number, rot = 0, a = 1, more: Partial<SheetPose> = {}): SheetPose => ({ dx, dy, rot, sx: 1, tip: 0, sc: 1, a, ...more });
const stack = (step: number): PegPose["s"] => [sheet(0, 0), sheet(step, -step), sheet(step * 2, -step * 2), sheet(step * 3, -step * 3)];
const base: PegPose = { x: -12, lift: 0, rot: -3, sx: 1, sy: 1, lean: 0, s: stack(8), slot: 1, wink: 0, o: 1, curl: 0, speed: 0, impact: 0, spark: 0 };

export const poses: Record<string, PegPose> = {
  rest: base,
  squash: { ...base, rot: 0, sx: 1.14, sy: 0.76, s: stack(4), slot: 0.3, o: 0.8, impact: 1 },
  dash: {
    ...base, x: 36, lift: 9, rot: 0, lean: 13, slot: 0.6, o: 1.25, speed: 1,
    s: [sheet(0, 0), sheet(-14, 0, 0, 0.62), sheet(-32, 0, 0, 0.36), sheet(-54, 0, 0, 0.18)],
  },
  fan: { ...base, x: 0, rot: 0, spark: 1, o: 1.35, s: [sheet(0, 0, -15), sheet(0, 0, -5), sheet(0, 0, 5), sheet(0, 0, 15)] },
  flip: {
    ...base, x: -26, rot: 0,
    s: [sheet(58, -76, 24, 1, { sx: 0.36, tip: -20 }), sheet(0, 0), sheet(8, -8), sheet(16, -16)],
  },
  peek: { ...base, rot: 2, curl: 1 },
  wink: { ...base, rot: 4, wink: 1, o: 0.9, spark: 0.9 },
  deal: {
    ...base, x: 0, rot: 0,
    s: [sheet(-78, 0, -5, 1, { sc: 0.4 }), sheet(-26, -22, 4, 1, { sc: 0.4 }), sheet(26, 0, -3, 1, { sc: 0.4 }), sheet(78, -22, 6, 1, { sc: 0.4 })],
  },
};

export const poseNotes: Record<string, [string, string]> = {
  rest: ["Squared up", "Three degrees off true, whistling. Nothing to see here."],
  squash: ["Tap down", "It squares itself before and after every move. Soft, so it squashes."],
  dash: ["Onion trail", "Fast travel fans the back slabs into ghosts. The trail is anatomy."],
  fan: ["Fan", "The show-off beat. A card flourish, performed by the cards."],
  flip: ["Page turn", "Its walk: the top slab flips ahead, the rest follow."],
  peek: ["Corner peel", "And another thing: there is a second one under this one."],
  wink: ["Wink", "After the trick. It knows you saw."],
  deal: ["Deal", "Batch. Each slab stands as its own entry, same punch."],
};
export const poseOrder = ["rest", "squash", "dash", "fan", "flip", "peek", "wink", "deal"];

// Each `since` is the level at which it learns the beat. A clever show-off
// keeps revealing another thing it can do.
export const beats: Beat<PegPose>[] = [
  { pose: poses.rest, move: 0.4, hold: 0.8, ease: "inOut" },
  { pose: poses.squash, move: 0.16, hold: 0.1, ease: "out" },
  { pose: poses.dash, move: 0.2, hold: 0.5, ease: "out", since: 2 },
  { pose: poses.squash, move: 0.14, hold: 0.06, ease: "in", since: 2 },
  { pose: poses.fan, move: 0.34, hold: 1.0, ease: "back", since: 3 },
  { pose: poses.wink, move: 0.3, hold: 0.7, ease: "inOut", since: 3 },
  { pose: poses.peek, move: 0.26, hold: 0.9, ease: "out", since: 4 },
];

/** A way it could grow: one slab per level. A sample, not a decision. */
export const grown = (level: number): PegState => ({ slabs: Math.max(1, Math.min(4, Math.round(level))) });

/** Idle breathing on top of a pose, from absolute time. */
export function idle(pose: PegPose, seconds: number): PegPose {
  const breath = Math.sin(seconds * 2.4) * 0.5 * clamp(1 - pose.speed - pose.impact);
  return { ...pose, s: pose.s.map((s, k) => ({ ...s, dy: s.dy - breath * k * 0.7 })) as PegPose["s"], slot: lerp(pose.slot, pose.slot * 0.2, blink(seconds)) };
}
function blink(seconds: number): number {
  const t = seconds % 3.6;
  return t > 3.4 ? Math.sin(((t - 3.4) / 0.2) * Math.PI) : 0;
}

// ── props ──────────────────────────────────────────────────────────────────

/** The peg bar it registers on. Dock here and it sits in the same place every time. */
export function pegBar(): Item[] {
  return [
    { id: "bar", role: "bar", shape: poly([[-104, -96], [104, -96], [104, -70], [-104, -70]], 6) },
    { id: "peg-l", role: "pin", shape: capsule(-35, -83, 20, 7), flat: true },
    { id: "peg-c", role: "pin", shape: circle(0, -83, 5), flat: true },
    { id: "peg-r", role: "pin", shape: capsule(35, -83, 20, 7), flat: true },
  ];
}

/** Registered: hung on the bar, pegs through the punch. The same place in any work. */
export function docked(): Item[] {
  const hung = build({ ...poses.rest, x: -9, rot: 0, lift: 30 });
  const centre = (id: string): Pt => {
    const b = bounds(hung.filter(i => i.id === id));
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  };
  const [l, c, r] = [centre("slot-l-0"), centre("hole-0"), centre("slot-r-0")];
  return [
    hung[0],
    { id: "bar", role: "bar", shape: poly([[c[0] - 104, c[1] - 13], [c[0] + 112, c[1] - 13], [c[0] + 112, c[1] + 13], [c[0] - 104, c[1] + 13]], 6) },
    ...hung.slice(1),
    { id: "peg-l", role: "pin", shape: capsule(l[0], l[1], 18, 6), flat: true },
    { id: "peg-c", role: "pin", shape: circle(c[0], c[1], 4.2), flat: true },
    { id: "peg-r", role: "pin", shape: capsule(r[0], r[1], 18, 6), flat: true },
  ];
}

/** Mark seed: the front sheet with its punch, plus two echoes. */
export function mark(): Item[] {
  const sheets: Item[] = [];
  for (let k = 2; k >= 0; k--) {
    sheets.push(...placeAll([{ id: `mark-sheet-${k}`, role: k === 0 ? "sheet0" : k === 1 ? "sheet1" : "sheet3", thin: true, shape: sheetShape(0) }, ...(k === 0 ? punch(0, 1, 1) : [])], move(k * 13 - 13, -k * 13 - 76)));
  }
  return sheets;
}

// ── material ───────────────────────────────────────────────────────────────

/** One material in every world. The era belongs to the surroundings. */
export const skin: Era = {
  id: "toy", label: "Soft sculpted toy", when: "always", note: "Squishy, weighty, slightly handmade.",
  treatment: "toy", bg: "#e9e2d3", line: "#2a1208", lineWidth: 0, fps: 60, shade: ["hole"],
  opts: { lip: 5.5, jitter: 0.8 },
  palette: {
    sheet0: { grad: ["#fffaf0", "#f0e6d2"] }, sheet1: { grad: ["#ff8552", "#ee5420"] },
    sheet2: { grad: ["#ffd96a", "#f2b92e"] }, sheet3: { grad: ["#5f78ff", "#2e4bff"] },
    hole: "#2a1208", flap: { grad: ["#e6d9c0", "#d8c8aa"] }, bar: { grad: ["#4a4038", "#2f2822"] }, pin: "#f5c84b",
    fx: "#17140f", shadow: "#b5ab95",
  },
};

/** Small variations to react to. */
export const nudges: Record<string, () => Item[]> = {
  a: () => build(poses.rest),
  b: () => build(poses.rest, { slabs: 4, inline: true }),
  c: () => build({ ...poses.rest, wink: 0.55 }),
};

export const peg = {
  id: "peg", name: "Peg",
  idea: "A stack of soft slabs, punched like animation paper. The punch is its face; the stack is its motion trail.",
  build, poses, poseNotes, poseOrder, beats, idle, skin, grown, nudges, mark, groups: { docked, pegBar },
};
