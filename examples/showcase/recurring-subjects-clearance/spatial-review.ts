import { sampleMorning } from "./model";
import type { SPOON_POSE } from "./spatial-data";

export type Point = readonly [number, number, number];
export type Bounds = { readonly min: Point; readonly max: Point };
export type SpatialPart = { readonly id: string; readonly entityId: string; readonly bounds: Bounds };
export type ClearanceRule = { readonly id: string; readonly between: readonly [string, string]; readonly minimumCm: number };
export const RULES: readonly ClearanceRule[] = [
  { id: "breakfast-spoon-clearance", between: ["breakfast", "spoon"], minimumCm: .8 },
  { id: "counter-spoon-clearance", between: ["counter", "spoon"], minimumCm: .8 },
];
export type ClearanceObservation = {
  ruleId: string; subjects: readonly [string, string]; requiredMinimumCm: number;
  status: "clear" | "possible-intersection" | "clearance-unverified" | "unverified";
  evidence: "declared-part-aabb" | "missing-proxy";
  distanceLowerBoundCm: number | null; limitingParts: readonly string[];
};

/** Same Euler XYZ order as the rendered Three groups. Transforms all eight corners. */
export function placeBounds(box: Bounds, position: readonly number[], tilt: number, yaw: number): Bounds {
  if (position.length !== 3 || ![...position, tilt, yaw, ...box.min, ...box.max].every(Number.isFinite)
    || box.min.some((v, i) => v > box.max[i]!)) throw new TypeError("Invalid spatial bounds/transform");
  const points: number[][] = [];
  for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
    const rx = x * Math.cos(yaw) + z * Math.sin(yaw), rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
    points.push([rx + position[0]!, y * Math.cos(tilt) - rz * Math.sin(tilt) + position[1]!, y * Math.sin(tilt) + rz * Math.cos(tilt) + position[2]!]);
  }
  return { min: [0, 1, 2].map(i => Math.min(...points.map(p => p[i]!))) as unknown as Point,
    max: [0, 1, 2].map(i => Math.max(...points.map(p => p[i]!))) as unknown as Point };
}
export function boundsDistanceLowerBound(a: Bounds, b: Bounds): number {
  return Math.hypot(...a.min.map((n, i) => Math.max(0, n - b.max[i]!, b.min[i]! - a.max[i]!)));
}
/** Pure observations, not host blocking policy or a mesh collision verdict. */
export function evaluateClearance(parts: readonly SpatialPart[], rules = RULES): readonly ClearanceObservation[] {
  if (new Set(parts.map(p => p.id)).size !== parts.length) throw new TypeError("Duplicate spatial part id");
  for (const part of parts) placeBounds(part.bounds, [0, 0, 0], 0, 0);
  return rules.map(rule => {
    if (!rule.id || !Number.isFinite(rule.minimumCm) || rule.minimumCm < 0 || rule.between[0] === rule.between[1]) throw new TypeError("Invalid clearance rule");
    const left = parts.filter(p => p.entityId === rule.between[0]), right = parts.filter(p => p.entityId === rule.between[1]);
    const base = { ruleId: rule.id, subjects: rule.between, requiredMinimumCm: rule.minimumCm };
    if (!left.length || !right.length) return { ...base, status: "unverified", evidence: "missing-proxy", distanceLowerBoundCm: null, limitingParts: [] };
    let distance = Infinity, limitingParts: string[] = [];
    for (const a of left) for (const b of right) {
      const d = boundsDistanceLowerBound(a.bounds, b.bounds);
      if (d < distance) { distance = d; limitingParts = [a.id, b.id]; }
    }
    return { ...base, status: distance >= rule.minimumCm ? "clear" : distance === 0 ? "possible-intersection" : "clearance-unverified",
      evidence: "declared-part-aabb", distanceLowerBoundCm: distance, limitingParts };
  });
}

export function spatialParts(frame: ReturnType<typeof sampleMorning>, spoonPose: typeof SPOON_POSE = frame.spoon.data.performance): SpatialPart[] {
  const parts: SpatialPart[] = [];
  for (const mug of frame.mugs) {
    const p = mug.data.performance;
    const radius = Math.max(...mug.data.design.profile.map(p => p.radius)) + .055;
    const top = Math.max(...mug.data.design.profile.map(p => p.y));
    const transform = (bounds: Bounds) => placeBounds(bounds, p.position, p.tilt * Math.PI / 180, p.yaw * Math.PI / 180);
    parts.push({ id: `${mug.entityId}/body`, entityId: mug.entityId, bounds: transform({ min: [-radius, -.03, -radius], max: [radius, top, radius] }) },
      // Conservative authored envelope for this handle revision; browser proof
      // checks actual mesh vertices fit. Do not present it as a mesh distance.
      { id: `${mug.entityId}/handle`, entityId: mug.entityId, bounds: transform({ min: [3, 2.1, -.675], max: [7.5, 9, .675] }) });
  }
  const d = frame.spoon.data.design;
  const transform = (bounds: Bounds) => placeBounds(bounds, spoonPose.position, spoonPose.tilt, spoonPose.yaw);
  parts.push({ id: "spoon/bowl", entityId: "spoon", bounds: transform({ min: [-d.bowl.x, -d.bowl.y, -d.bowl.z], max: [d.bowl.x, d.bowl.y, d.bowl.z] }) });
  const radius = Math.max(d.stem.topRadius, d.stem.bottomRadius);
  parts.push({ id: "spoon/stem", entityId: "spoon", bounds: transform({ min: [-radius, -radius, d.stem.centerZ - d.stem.length / 2], max: [radius, radius, d.stem.centerZ + d.stem.length / 2] }) });
  return parts;
}
export function observeSpace(frame: ReturnType<typeof sampleMorning>, spoonPose: typeof SPOON_POSE = frame.spoon.data.performance) {
  const parts = spatialParts(frame, spoonPose), observations = evaluateClearance(parts);
  return { units: "cm", seconds: frame.seconds, observations,
    minimumClearanceCm: Math.min(...observations.map(o => o.distanceLowerBoundCm ?? -1)),
    warnings: observations.filter(o => o.status !== "clear"), parts };
}
