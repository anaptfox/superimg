import { subjectSet, visual, Vector, vector } from "@foxworth/superimg";
import { SPOON_DESIGN, SPOON_POSE } from "./spatial-data";

export const DURATION = 12;
export const PROFILE = [
  [0, .25], [3, .25], [3.15, 0], [3.55, 0], [3.75, .3], [4.05, 1.4],
  [4.2, 3.2], [4.15, 5.6], [4.02, 7.6], [3.98, 8.9], [4.04, 9.35],
  [3.94, 9.55], [3.78, 9.42], [3.62, 8.9], [3.62, 7.6], [3.72, 5.6],
  [3.74, 3.2], [3.55, 1.6], [2.9, .95], [0, .85],
] as const;
export const DESIGN = {
  glaze: "#c4834a", liner: "#efe5d3", clay: "#cbb393", lip: "#e6c79c",
  profile: PROFILE.map(([radius, y]) => ({ radius, y })), seed: 281,
};
export type MugData = {
  design: typeof DESIGN;
  state: { fill: number; tide: boolean };
  performance: { position: number[]; yaw: number; tilt: number; steam: number; liquidTilt: number };
};
// The same subject contract can have a vector representation. The film below
// deliberately projects its sampled design/data through one boxed WebGL world.
const mug = visual<MugData>({
  id: "hand-thrown-mug",
  render: ({ data }) => ({ parts: [{ id: "silhouette", bounds: { x: 0, y: 0, width: 14, height: 12 },
    content: Vector({ width: 14, height: 12 },
      vector.path({ d: "M1 1H9V9Q9 11 7 11H3Q1 11 1 9Z", fill: data.design.glaze }),
      vector.path({ d: "M9 3H11Q14 3 14 6Q14 9 11 9H9", fill: "none", stroke: data.design.glaze, strokeWidth: 1 }),
    ) }] }),
});
export const subjects = subjectSet({
  designs: {
    ceramic: { of: mug, design: DESIGN, revision: "ceramic-2", styleRevision: "morning-light-1", appearanceId: "honey-glaze" },
    brass: { of: visual<{ design: typeof SPOON_DESIGN; state: Record<string, never>; performance: typeof SPOON_POSE }>({
      id: "brass-spoon", render: ({ data }) => ({ parts: [{ id: "silhouette", bounds: { x: 0, y: 0, width: 2, height: 9 },
        content: Vector({ width: 2, height: 9 }, vector.path({ d: "M.8 2H1.2V9H.8ZM0 1a1 1 0 1 0 2 0a1 1 0 1 0-2 0", fill: data.design.metal })) }] }),
    }), design: SPOON_DESIGN, revision: "brass-spoon-1", styleRevision: "morning-light-1" },
  },
  entities: { breakfast: { design: "ceramic" }, counter: { design: "ceramic" }, spoon: { design: "brass" } },
});
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ramp = (s: number, a: number, b: number) => clamp((s - a) / (b - a));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const cubic = (p: number) => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const vectorMix = (a: number[], b: number[], p: number) => a.map((n, i) => mix(n, b[i]!, p));

export function sampleMorning(seconds: number, square = false, spoonPose: typeof SPOON_POSE = SPOON_POSE) {
  if (!Number.isFinite(seconds)) throw new TypeError("Morning time must be finite");
  const s = Math.max(0, Math.min(DURATION, seconds));
  const later = s >= 5;
  const lift = Math.pow(ramp(s, 3.4, 4.6), 3);
  const landing = ramp(s, 5.2, 6.4);
  const down = 1 - Math.pow(1 - landing, 3);
  const settle = s >= 6.15 && s < 6.4 ? -.15 * Math.sin(ramp(s, 6.15, 6.4) * Math.PI) : 0;
  const y = later ? .17 + 16 * (1 - down) + settle : .17 + 34 * lift;
  const rest = Math.max(0, s - 6.4);
  const hero = subjects.sample("breakfast", {
    state: { fill: later ? .55 : 1, tide: later },
    performance: {
      position: later ? [-4.6, y, 5.2] : [-5.5 + 1.5 * lift, y, 6],
      yaw: later ? -70 : -35, tilt: later ? 0 : -10 * lift,
      steam: s >= 4.6 && s < 5.2 ? 0 : later ? .45 : .7,
      liquidTilt: later ? .025 * Math.exp(-rest / .35) * Math.cos(Math.PI * 4.4 * rest) : 0,
    },
  });
  const counter = subjects.sample("counter", {
    state: { fill: 1, tide: false },
    performance: { position: [11, 0, -16], yaw: -200, tilt: 0, steam: later ? .45 : .7, liquidTilt: 0 },
  });
  const push = .5 - .5 * Math.cos(Math.PI * ramp(s, 0, 5));
  const arc = cubic(ramp(s, 7.6, 10));
  const camera = later ? {
    focal: mix(square ? 58 : 85, square ? 42 : 56, arc),
    position: vectorMix(square ? [10, 44, 40] : [12, 40, 42], square ? [-7, 60, 66] : [-8, 53, 65], arc),
    target: vectorMix([-5.5, 3, 6], square ? [0, 13, -1] : [0, 6, 0], arc),
  } : {
    focal: square ? 32 : 40,
    position: vectorMix(square ? [-2, 22, 57] : [-4, 19, 52], square ? [-4, 19, 46] : [-6, 16, 41], push),
    target: square ? [0, 8 + lift * 1.2, -3] : [-2, 4 + 1.2 * lift, -3],
  };
  const opening = ramp(s, .6, 1.2) * (1 - ramp(s, 2.8, 3.2));
  const ending = ramp(s, 9.8, 10.5);
  return {
    seconds: s, shot: later ? "later" : "morning", later,
    camera, mugs: [hero, counter],
    spoon: subjects.sample("spoon", { state: {}, performance: spoonPose }),
    timestamp: later ? "8:19 AM" : "8:02 AM", opening, ending,
    ring: ramp(s, 3.4, 4.3),
  };
}
