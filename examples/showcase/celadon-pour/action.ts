//! Pure action sampler: absolute seconds → accepted state. No renderer state.

export const POT_SCALE = 0.9;
export const CUP_SCALE = 1.4;
export const TRIVET = { x: 540, y: 520 };
export const SEAT = { x: TRIVET.x, y: TRIVET.y - 14 };
export const CUP = { x: 868, y: 542 };
const SPOUT = { x: 181, y: -147.5 };
const GRIP = { x: -158, y: -90 };

export type ShotId = "wide" | "close" | "medium";
export const SHOTS: { id: ShotId; from: number; camera: { x: number; y: number; zoom: number } }[] = [
  { id: "wide", from: 0, camera: { x: 200, y: 170, zoom: 1.36 } },
  { id: "close", from: 3.6, camera: { x: 572, y: 214, zoom: 2.05 } },
  { id: "medium", from: 7.2, camera: { x: 330, y: 196, zoom: 1.45 } },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const io = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const out = (u: number) => 1 - Math.pow(1 - u, 3);
const inq = (u: number) => u * u * u;
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const rot = (p: { x: number; y: number }, deg: number, s: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: s * (Math.cos(r) * p.x - Math.sin(r) * p.y), y: s * (Math.sin(r) * p.x + Math.cos(r) * p.y) };
};

/** Pot pose whose spout lip sits at a world point. */
function poseForSpout(target: { x: number; y: number }, tilt: number) {
  const o = rot(SPOUT, tilt, POT_SCALE);
  return { x: target.x - o.x, y: target.y - o.y, tilt };
}

type Pose = { x: number; y: number; tilt: number };
const REST: Pose = { x: SEAT.x, y: SEAT.y, tilt: 0 };
const LIFTED: Pose = { x: SEAT.x + 50, y: SEAT.y - 78, tilt: 7 };
const APPROACH: Pose = poseForSpout({ x: 808, y: 300 }, 24);
const POUR: Pose = poseForSpout({ x: 820, y: 296 }, 41);
const POUR_DEEP: Pose = poseForSpout({ x: 822, y: 300 }, 47);
const LEAVE: Pose = poseForSpout({ x: 800, y: 286 }, 18);
const HOVER: Pose = { x: SEAT.x + 6, y: SEAT.y - 22, tilt: 1 };

function between(a: Pose, b: Pose, u: number): Pose {
  return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), tilt: mix(a.tilt, b.tilt, u) };
}

function potPose(t: number): Pose {
  if (t < 2.2) return REST;
  if (t < 3.6) return between(REST, LIFTED, io(ramp(t, 2.2, 3.6)));
  if (t < 4.15) return between(LIFTED, APPROACH, out(ramp(t, 3.6, 4.15)));
  if (t < 4.5) return between(APPROACH, POUR, io(ramp(t, 4.15, 4.5)));
  if (t < 6.3) return between(POUR, POUR_DEEP, io(ramp(t, 4.5, 6.3)));
  if (t < 6.9) return between(POUR_DEEP, LEAVE, io(ramp(t, 6.3, 6.9)));
  if (t < 7.2) return between(LEAVE, LEAVE, 0);
  if (t < 8.25) return between(LEAVE, HOVER, io(ramp(t, 7.2, 8.25)));
  if (t < 8.55) return between(HOVER, REST, inq(ramp(t, 8.25, 8.55)));
  return REST;
}

export interface PourState {
  seconds: number;
  shot: (typeof SHOTS)[number];
  pot: Pose;
  /** Settle squash on contact, 0 = none. */
  settle: number;
  /** Hand offset from the grip in pot-local units; (0,0) = holding. */
  hand: { x: number; y: number; visible: boolean };
  /** Lift above the bench (world px) for the contact shadow. */
  lift: number;
  stream: { head: number; tail: number; length: number; spout: { x: number; y: number } } | null;
  tea: { level: number; ripple: number; steam: number };
}

export function samplePour(seconds: number): PourState {
  const t = clamp(seconds, 0, 10);
  const shot = [...SHOTS].reverse().find((s) => t >= s.from)!;
  const pot = potPose(t);
  // Reach in, hold, release.
  const reach = out(ramp(t, 0.5, 1.9));
  const release = inq(ramp(t, 8.75, 9.7));
  const away = 1 - reach + release;
  const hand = { x: -640 * away, y: -520 * away, visible: away < 0.999 };
  const lift = SEAT.y - pot.y;
  // Contact settle: a short damped dip after touchdown.
  const since = t - 8.55;
  const settle = since > 0 && since < 0.5 ? Math.sin(since * 22) * Math.exp(-since * 9) * 0.6 : 0;
  // Pour: head falls from the lip, tail leaves the lip when the pot tips back.
  const head = out(ramp(t, 4.4, 4.62));
  const tail = inq(ramp(t, 6.35, 6.62));
  const level = 0.84 * io(ramp(t, 4.55, 6.5));
  const spout = (() => { const o = rot(SPOUT, pot.tilt, POT_SCALE); return { x: pot.x + o.x, y: pot.y + o.y }; })();
  const surfaceY = CUP.y + CUP_SCALE * (-12 - 52 * Math.max(level, 0.04));
  const stream = head > 0 && tail < 1 ? { head, tail, length: (surfaceY - spout.y) / POT_SCALE, spout } : null;
  const pouring = t > 4.6 && t < 6.6;
  const ripple = pouring ? ((t - 4.6) / 0.42) % 1 : t >= 6.6 && t < 7.3 ? clamp((t - 6.6) / 0.7) : 0;
  const steam = clamp((level - 0.25) / 0.4) * 0.85;
  return { seconds: t, shot, pot, settle, hand, lift, stream, tea: { level, ripple, steam } };
}

export const GRIP_ANCHOR = GRIP;
export const SPOUT_ANCHOR = SPOUT;
