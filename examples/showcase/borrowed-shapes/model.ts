/** Six conserved materials acquire three forms. No state survives a frame. */
export const TRANSPORT_COUNT = 18_000;
export const GROUND_COUNT = 1_600;
export const PART_COUNT = 6;
export const GRAINS_PER_PART = 3_000;
export const WORLD_SIZE = 520;
export const FORMS_SECONDS = 30;
export const PART_STAGGER_SECONDS = .2;
export type FormName = "seed" | "tree" | "citadel";
export type FormsPhase = "bed" | "gather" | "seed" | "seed-tree" | "tree" | "tree-citadel" | "citadel" | "citadel-seed";

export interface FormsInput {
  teaching: boolean;
  fidelity: "full" | "reduced";
  inputVersion: number;
  followGrains: boolean;
  live: boolean;
  reducedMotion: boolean;
}
export const INITIAL_FORMS: Readonly<FormsInput> = Object.freeze({ teaching: false, fidelity: "full", inputVersion: 0, followGrains: false, live: true, reducedMotion: false });
export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }
export interface SurfacePoint extends Vec3 { readonly nx: number; readonly ny: number; readonly nz: number; readonly part: number; readonly sampleIndex: number }
export interface FormGrain extends SurfacePoint { readonly id: number; readonly seed: number; readonly radius: number; readonly drawn: boolean; readonly protected: boolean }
export interface GroundGrain extends Vec3 { readonly id: string; readonly radius: number; readonly seed: number; readonly drawn: boolean }
export interface FormsPose {
  readonly phase: FormsPhase;
  readonly from: FormName | "bed";
  readonly to: FormName | "bed";
  readonly progress: number;
}
export interface FormsSnapshot extends FormsPose {
  readonly seconds: number;
  readonly frame: number;
  readonly inputVersion: number;
  readonly fidelity: FormsInput["fidelity"];
  readonly grains: readonly FormGrain[];
  readonly ground: readonly GroundGrain[];
  readonly followedIds: readonly number[];
  readonly logicalGrains: number;
  readonly drawnGrains: number;
}

const TAU = 2 * Math.PI;
const VIEW_CS = Math.cos(-.42), VIEW_SN = Math.sin(-.42), VIEW_CP = Math.cos(.24), VIEW_SP = Math.sin(.24);
const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const minus = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const cross = (a: Vec3, b: Vec3): Vec3 => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
function normal(v: Vec3): Vec3 { const d = length(v); return d > 1e-10 ? vec(v.x / d, v.y / d, v.z / d) : vec(0, 1, 0); }

export function grainHash(index: number, salt = 0): number {
  let value = (index + 1 + salt * 10_003) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Zero velocity and acceleration at both endpoints. */
export function quintic(progress: number): number {
  const p = clamp(progress);
  return p * p * p * (p * (p * 6 - 15) + 10);
}

/** Constant three-quarter view. World y is up; positive z is nearer. */
export function projectForms(point: Vec3, scale = .94): Vec3 {
  const x = point.x * VIEW_CS + point.z * VIEW_SN;
  const z = point.z * VIEW_CS - point.x * VIEW_SN;
  return vec(x * scale, (-point.y * VIEW_CP + z * VIEW_SP) * scale,
    (point.y * VIEW_SP + z * VIEW_CP) * scale);
}

// The five directions sit eighteen degrees away from the nearest view axis.
// Sharing this frame keeps each seed lobe, limb, and tower corresponding.
function partAngle(part: number): number { return -.42 + (part - 1) * TAU / 5; }

function seedPoint(part: number, sampleIndex: number): SurfacePoint {
  const identity = part * GRAINS_PER_PART + sampleIndex;
  let phi = 0, theta = 0, v = 0;
  // Rejection sampling by the ellipsoid's surface Jacobian avoids a pile-up
  // at the poles. Relief is applied after sampling the underlying surface.
  for (let attempt = 0; attempt < 256; attempt++) {
    const sample = identity + attempt * 104_729;
    const u = grainHash(sample, 1); v = grainHash(sample, 2);
    phi = part === 0 ? (u < .5 ? u * .43 : .785 + (u - .5) * .43) * Math.PI : (.185 + u * .63) * Math.PI;
    theta = part === 0 ? v * TAU : partAngle(part) + (v - .5) * TAU / 5 * 1.025;
    const sin = Math.sin(phi), cos = Math.cos(phi);
    const jacobian = sin * Math.hypot(99 * 47 * sin * Math.cos(theta), 61 * 47 * cos, 61 * 99 * sin * Math.sin(theta));
    if (grainHash(sample, 10) * 99 * 61 <= jacobian) break;
    if (attempt === 255) throw new Error("Seed area sampler exhausted its deterministic bound");
  }
  const ridge = part === 0 ? 0 : 5.5 * Math.sin(Math.PI * v) ** 2;
  const rx = 61 + ridge, rz = 47 + ridge * .8, ry = 99;
  const x = Math.cos(theta) * Math.sin(phi) * rx;
  const y = 108 + Math.cos(phi) * ry;
  const z = Math.sin(theta) * Math.sin(phi) * rz;
  const n = normal(vec(x / (rx * rx), (y - 108) / (ry * ry), z / (rz * rz)));
  return { x, y, z, nx: n.x, ny: n.y, nz: n.z, part, sampleIndex };
}

interface Tube { a: Vec3; b: Vec3; r0: number; r1: number; area: number }
function tube(a: Vec3, b: Vec3, r0: number, r1: number): Tube { return { a, b, r0, r1, area: Math.PI * (r0 + r1) * length(minus(b, a)) }; }
function treeTubes(part: number): readonly Tube[] {
  if (part === 0) {
    const roots = Array.from({ length: 5 }, (_, i) => {
      const a = i * TAU / 5;
      return tube(vec(Math.cos(a) * 49, 3, Math.sin(a) * 49), vec(0, 28, 0), 2.7, 13);
    });
    return [tube(vec(0, 12, 0), vec(3, 97, -2), 18, 13), tube(vec(3, 97, -2), vec(-2, 178, 3), 13, 9), ...roots];
  }
  const a = partAngle(part), rx = Math.cos(a), rz = Math.sin(a), tx = -rz, tz = rx;
  const p = (radial: number, y: number, tangent = 0): Vec3 => vec(rx * radial + tx * tangent, y, rz * radial + tz * tangent);
  const lift = [0, 16, -7, 12, -12][part - 1]!;
  // Spread the first forks in the painted view; one terminal per limb remains.
  const elbowTangent = [8, 33, 15, 8, 4][part - 1]!;
  const elbow = p(74, 234 + lift, elbowTangent), bend = p(133, 296 + lift, -8);
  return [
    tube(vec(-2, 151, 3), elbow, 10, 8), tube(elbow, bend, 8, 5.2),
    tube(bend, p(177, 372 + lift, -2), 5.2, 1.6),
  ];
}

const TREE_TUBES = Array.from({ length: PART_COUNT }, (_, part) => treeTubes(part));
export const TREE_PRIMARY_TIPS: readonly Vec3[] = Object.freeze(TREE_TUBES.slice(1).map(tubes => Object.freeze(tubes.at(-1)!.b)));
export const TREE_LIMB_TERMINAL_COUNTS: readonly number[] = Object.freeze(TREE_TUBES.slice(1).map(tubes => tubes.filter(section =>
  !tubes.some(next => length(minus(section.b, next.a)) < 1e-8)).length));
/** Authored target geometry, measured through the same fixed paint projection. */
export function measureTreeTipSeparation(tips: readonly Vec3[] = TREE_PRIMARY_TIPS): number {
  let minimum = Infinity;
  const projected = tips.map(tip => projectForms(tip, .94 * 3));
  for (let i = 0; i < projected.length; i++) for (let j = i + 1; j < projected.length; j++) {
    minimum = Math.min(minimum, Math.hypot(projected[i]!.x - projected[j]!.x, projected[i]!.y - projected[j]!.y));
  }
  return minimum;
}
export const TREE_PRIMARY_FORKS: readonly Readonly<Pick<Tube, "a" | "b" | "r1">>[] = Object.freeze(TREE_TUBES.slice(1).map(sections => Object.freeze(sections[0]!)));
/** Projected first-section directions and clear gap at each elbow, rather than tips alone. */
export function measureTreeForkDirections(forks = TREE_PRIMARY_FORKS) {
  const limbs = forks.map(section => {
    const a = projectForms(section.a, .94 * 3), b = projectForms(section.b, .94 * 3);
    return { direction: Math.atan2(b.y - a.y, b.x - a.x), elbow: b, radius: section.r1 * .94 * 3 };
  });
  let minimumDegrees = Infinity, minimumElbowGap4K = Infinity;
  for (let i = 0; i < limbs.length; i++) for (let j = i + 1; j < limbs.length; j++) {
    const a = limbs[i]!, b = limbs[j]!, angle = Math.abs(a.direction - b.direction);
    minimumDegrees = Math.min(minimumDegrees, Math.min(angle, TAU - angle) * 180 / Math.PI);
    minimumElbowGap4K = Math.min(minimumElbowGap4K, Math.hypot(a.elbow.x - b.elbow.x, a.elbow.y - b.elbow.y) - a.radius - b.radius);
  }
  return { minimumDegrees, minimumElbowGap4K, scope: "centerline directions and conservative circular envelope at first-section elbows; shared junction intentionally touches" };
}
function treePoint(part: number, sampleIndex: number): SurfacePoint {
  const identity = part * GRAINS_PER_PART + sampleIndex;
  const tubes = TREE_TUBES[part]!;
  const total = tubes.reduce((sum, section) => sum + section.area, 0);
  let area = grainHash(identity, 3) * total;
  let selected = tubes.at(-1)!;
  for (const section of tubes) { if (area <= section.area) { selected = section; break; } area -= section.area; }
  // Frustum surface density is proportional to circumference along its axis.
  const q = grainHash(identity, 4);
  const delta = selected.r1 - selected.r0;
  const u = Math.abs(delta) < 1e-9 ? q : (-selected.r0 + Math.sqrt(selected.r0 ** 2 + delta * q * (selected.r0 + selected.r1))) / delta;
  const axis = normal(minus(selected.b, selected.a));
  const tangent = normal(cross(axis, Math.abs(axis.z) < .8 ? vec(0, 0, 1) : vec(0, 1, 0)));
  const bitangent = cross(axis, tangent);
  const angle = grainHash(identity, 5) * TAU;
  const radial = vec(tangent.x * Math.cos(angle) + bitangent.x * Math.sin(angle), tangent.y * Math.cos(angle) + bitangent.y * Math.sin(angle), tangent.z * Math.cos(angle) + bitangent.z * Math.sin(angle));
  const r = mix(selected.r0, selected.r1, u);
  const n = normal(vec(radial.x - axis.x * delta / length(minus(selected.b, selected.a)), radial.y - axis.y * delta / length(minus(selected.b, selected.a)), radial.z - axis.z * delta / length(minus(selected.b, selected.a))));
  return { x: mix(selected.a.x, selected.b.x, u) + radial.x * r, y: mix(selected.a.y, selected.b.y, u) + radial.y * r, z: mix(selected.a.z, selected.b.z, u) + radial.z * r, nx: n.x, ny: n.y, nz: n.z, part, sampleIndex };
}

interface Box { center: Vec3; width: number; height: number; depth: number; angle: number; area: number }
function box(center: Vec3, width: number, height: number, depth: number, angle = 0): Box {
  return { center, width, height, depth, angle, area: 2 * (width * height + height * depth + depth * width) };
}
function wall(a: Vec3, b: Vec3, height = 53): Box {
  const delta = minus(b, a);
  return box(vec((a.x + b.x) / 2, height / 2, (a.z + b.z) / 2), Math.hypot(delta.x, delta.z), height, 12, -Math.atan2(delta.z, delta.x));
}
const TOWER_HEIGHTS = [242, 277, 252, 297, 262];
// Unequal courtyard setbacks separate all five masses in the fixed camera.
// Angles remain shared with the seed lobes and tree limbs.
const TOWER_RADII = [188, 292, 98, 226, 70];
const TOWER_ANCHORS = Array.from({ length: 5 }, (_, i) => vec(Math.cos(partAngle(i + 1)) * TOWER_RADII[i]!, 0, Math.sin(partAngle(i + 1)) * TOWER_RADII[i]!));
/** Screen-x center spacing prevents rear towers sharing a front silhouette. */
export function measureTowerHorizontalSeparation(anchors: readonly Vec3[] = TOWER_ANCHORS): number {
  const xs = anchors.map(anchor => projectForms(anchor, .94 * 3).x).sort((a, b) => a - b);
  return Math.min(...xs.slice(1).map((x, i) => x - xs[i]!));
}
function citadelBoxes(part: number): readonly Box[] {
  if (part === 0) return [box(vec(-34, 44, 114), 17, 88, 21), box(vec(34, 44, 114), 17, 88, 21), box(vec(0, 83, 114), 86, 18, 21)];
  const index = part - 1, anchor = TOWER_ANCHORS[index]!, next = TOWER_ANCHORS[(index + 1) % 5]!;
  const angle = partAngle(part), h = TOWER_HEIGHTS[index]!;
  const merlons: Box[] = [];
  for (const x of [-20, 20]) for (const z of [-20, 20]) {
    const rx = x * Math.cos(angle) + z * Math.sin(angle), rz = z * Math.cos(angle) - x * Math.sin(angle);
    merlons.push(box(vec(anchor.x + rx, h + 7, anchor.z + rz), 11, 14, 11, angle));
  }
  const walls = index === 1 ? [wall(anchor, vec(43, 0, 114))]
    : index === 2 ? [wall(anchor, next), wall(anchor, vec(-43, 0, 114))] : [wall(anchor, next)];
  return [box(vec(anchor.x, h / 2, anchor.z), 54, h, 54, angle), ...merlons, ...walls];
}
const CITADEL_BOXES = Array.from({ length: PART_COUNT }, (_, part) => citadelBoxes(part));
function citadelPoint(part: number, sampleIndex: number): SurfacePoint {
  const identity = part * GRAINS_PER_PART + sampleIndex;
  const boxes = CITADEL_BOXES[part]!;
  let area = grainHash(identity, 6) * boxes.reduce((sum, volume) => sum + volume.area, 0);
  let selected = boxes.at(-1)!;
  for (const volume of boxes) { if (area <= volume.area) { selected = volume; break; } area -= volume.area; }
  const faceAreas = [selected.height * selected.depth, selected.height * selected.depth, selected.width * selected.depth, selected.width * selected.depth, selected.width * selected.height, selected.width * selected.height];
  let faceArea = grainHash(identity, 7) * selected.area;
  let face = 5;
  for (let i = 0; i < 6; i++) { if (faceArea <= faceAreas[i]!) { face = i; break; } faceArea -= faceAreas[i]!; }
  const u = grainHash(identity, 8) - .5, v = grainHash(identity, 9) - .5;
  const local = face < 2 ? vec((face ? 1 : -1) * selected.width / 2, u * selected.height, v * selected.depth)
    : face < 4 ? vec(u * selected.width, (face === 3 ? 1 : -1) * selected.height / 2, v * selected.depth)
      : vec(u * selected.width, v * selected.height, (face === 5 ? 1 : -1) * selected.depth / 2);
  const n = face < 2 ? vec(face ? 1 : -1, 0, 0) : face < 4 ? vec(0, face === 3 ? 1 : -1, 0) : vec(0, 0, face === 5 ? 1 : -1);
  const cs = Math.cos(selected.angle), sn = Math.sin(selected.angle);
  return { x: selected.center.x + local.x * cs + local.z * sn, y: selected.center.y + local.y, z: selected.center.z + local.z * cs - local.x * sn, nx: n.x * cs + n.z * sn, ny: n.y, nz: n.z * cs - n.x * sn, part, sampleIndex };
}

/** Ten bits per axis; stable ties keep seeded sample order. */
export function morton10(x: number, y: number, z: number): number {
  let code = 0;
  for (let bit = 0; bit < 10; bit++) code |= ((x >>> bit) & 1) << (bit * 3) | ((y >>> bit) & 1) << (bit * 3 + 1) | ((z >>> bit) & 1) << (bit * 3 + 2);
  return code >>> 0;
}
function sortedMorton(points: readonly SurfacePoint[], localPart?: number): readonly SurfacePoint[] {
  const angle = localPart && localPart > 0 ? partAngle(localPart) : 0;
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const local = points.map(p => vec(p.x * cs + p.z * sn, p.y, -p.x * sn + p.z * cs));
  const mins = vec(Math.min(...local.map(p => p.x)), Math.min(...local.map(p => p.y)), Math.min(...local.map(p => p.z)));
  const maxs = vec(Math.max(...local.map(p => p.x)), Math.max(...local.map(p => p.y)), Math.max(...local.map(p => p.z)));
  const normalized = (v: number, lo: number, hi: number) => Math.round(clamp((v - lo) / Math.max(1e-6, hi - lo)) * 1023);
  return Object.freeze(points.map((point, i) => ({ point, key: morton10(normalized(local[i]!.x, mins.x, maxs.x), normalized(local[i]!.y, mins.y, maxs.y), normalized(local[i]!.z, mins.z, maxs.z)), index: i }))
    .sort((a, b) => a.key - b.key || a.index - b.index).map(item => Object.freeze(item.point)));
}

const RAW_FORMS: Readonly<Record<FormName, readonly SurfacePoint[]>> = Object.freeze(Object.fromEntries((["seed", "tree", "citadel"] as const).map(form => [form,
  Object.freeze(Array.from({ length: TRANSPORT_COUNT }, (_, id) => {
    const part = Math.floor(id / GRAINS_PER_PART), i = id % GRAINS_PER_PART;
    return form === "seed" ? seedPoint(part, i) : form === "tree" ? treePoint(part, i) : citadelPoint(part, i);
  })),
])) as unknown as Record<FormName, readonly SurfacePoint[]>);
export const FORM_TARGETS: Readonly<Record<FormName, readonly SurfacePoint[]>> = Object.freeze(Object.fromEntries((["seed", "tree", "citadel"] as const).map(form => [form,
  Object.freeze(Array.from({ length: PART_COUNT }, (_, part) => sortedMorton(RAW_FORMS[form].slice(part * GRAINS_PER_PART, (part + 1) * GRAINS_PER_PART), part)).flat()),
])) as unknown as Record<FormName, readonly SurfacePoint[]>);

/** Two separated front-facing surface samples per part at both tall holds. */
export const FOLLOWED_IDS: readonly number[] = Object.freeze(Array.from({ length: PART_COUNT }, (_, part) => {
  const candidates = Array.from({ length: GRAINS_PER_PART }, (_, i) => {
    const id = part * GRAINS_PER_PART + i;
    const tree = FORM_TARGETS.tree[id]!, citadel = FORM_TARGETS.citadel[id]!;
    const facing = (point: SurfacePoint) => projectForms(vec(point.nx, point.ny, point.nz), 1).z;
    return { id, tree, citadel, score: Math.min(facing(tree), facing(citadel)) };
  }).filter(candidate => part === 0 ? candidate.tree.y > 45 && candidate.tree.y < 145 : candidate.tree.y > 220 && candidate.citadel.y > 120)
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const first = candidates[0]!;
  const screen = projectForms(first.tree);
  const second = candidates.find(candidate => {
    const p = projectForms(candidate.tree);
    return candidate.id !== first.id && candidate.score > .05 && Math.hypot(p.x - screen.x, p.y - screen.y) >= 25;
  });
  if (!second) throw new Error(`No separated visible diagnostic surfaces for part ${part}`);
  return [first.id, second.id];
}).flat());
const FOLLOW_SET = new Set(FOLLOWED_IDS);
function silhouette(point: SurfacePoint): boolean {
  const p = projectForms(vec(point.nx, point.ny, point.nz), 1);
  return Math.abs(p.z) < .17;
}
const PROTECTED = Object.freeze(Array.from({ length: TRANSPORT_COUNT }, (_, id) => FOLLOW_SET.has(id) || (["seed", "tree", "citadel"] as const).some(form => silhouette(FORM_TARGETS[form][id]!))));
const BED = Object.freeze(Array.from({ length: TRANSPORT_COUNT }, (_, id) => {
  const a = grainHash(id, 17) * TAU, r = Math.sqrt(grainHash(id, 18));
  return vec(Math.cos(a) * r * 221, .6 + grainHash(id, 19) * 2, Math.sin(a) * r * 89);
}));
const GROUND = Object.freeze(Array.from({ length: GROUND_COUNT }, (_, id) => {
  const a = grainHash(id, 23) * TAU, r = .32 + .68 * Math.sqrt(grainHash(id, 24));
  return Object.freeze({ id: `ground-${id}`, x: Math.cos(a) * r * 314, y: .3, z: Math.sin(a) * r * 163, radius: .42 + grainHash(id, 25) * .65, seed: grainHash(id, 26) });
}));

export function formsPose(seconds: number): FormsPose {
  const t = clamp(seconds, 0, FORMS_SECONDS);
  if (t < .5) return { phase: "bed", from: "bed", to: "bed", progress: 0 };
  if (t < 3) return { phase: "gather", from: "bed", to: "seed", progress: (t - .5) / 2.5 };
  if (t < 6) return { phase: "seed", from: "seed", to: "seed", progress: 1 };
  if (t < 11) return { phase: "seed-tree", from: "seed", to: "tree", progress: (t - 6) / 5 };
  if (t < 14) return { phase: "tree", from: "tree", to: "tree", progress: 1 };
  if (t < 19) return { phase: "tree-citadel", from: "tree", to: "citadel", progress: (t - 14) / 5 };
  if (t < 22) return { phase: "citadel", from: "citadel", to: "citadel", progress: 1 };
  if (t < 27) return { phase: "citadel-seed", from: "citadel", to: "seed", progress: (t - 22) / 5 };
  return { phase: "seed", from: "seed", to: "seed", progress: 1 };
}

/** Limbs I–V begin .2 seconds apart; the core begins last. All arrive by the original endpoint. */
export function formsPartProgress(pose: FormsPose, part: number): number {
  if (pose.from === "bed" || pose.from === pose.to) return pose.progress;
  const delay = PART_STAGGER_SECONDS * (part === 0 ? 5 : part - 1);
  return clamp((pose.progress * 5 - delay) / (5 - delay));
}

// Identity paint and arc values are immutable; sampling never re-hashes them.
const GRAIN_STYLE = Object.freeze(Array.from({ length: TRANSPORT_COUNT }, (_, id) => Object.freeze({
  seed: grainHash(id, 33), radius: .58 + grainHash(id, 34) * .7,
  amplitude: 8 + grainHash(id, 31) * 16,
  cos: Math.cos(grainHash(id, 32) * TAU), sin: Math.sin(grainHash(id, 32) * TAU),
})));
function transported(from: Vec3, to: Vec3, p: number, eased: number, envelope: number, id: number): Vec3 {
  if (p === 0) return vec(from.x, from.y, from.z);
  if (p === 1) return vec(to.x, to.y, to.z);
  const style = GRAIN_STYLE[id] ?? { amplitude: 8 + grainHash(id, 31) * 16, cos: Math.cos(grainHash(id, 32) * TAU), sin: Math.sin(grainHash(id, 32) * TAU) };
  const arc = envelope * style.amplitude;
  return vec(mix(from.x, to.x, eased) + style.cos * arc * .24, mix(from.y, to.y, eased) + arc, mix(from.z, to.z, eased) + style.sin * arc * .24);
}
export function transportPosition(from: Vec3, to: Vec3, progress: number, id: number): Vec3 {
  const p = clamp(progress);
  return transported(from, to, p, quintic(p), Math.sin(Math.PI * p) ** 2, id);
}
function sampleGrains(pose: FormsPose, fidelity: FormsInput["fidelity"]): readonly FormGrain[] {
  const parts = Array.from({ length: PART_COUNT }, (_, part) => { const progress = formsPartProgress(pose, part); return { progress, eased: quintic(progress), envelope: Math.sin(Math.PI * progress) ** 2 }; });
  const source = pose.from === "bed" ? BED : FORM_TARGETS[pose.from];
  const target = pose.to === "bed" ? BED : FORM_TARGETS[pose.to];
  return Object.freeze(Array.from({ length: TRANSPORT_COUNT }, (_, id): FormGrain => {
    const from = source[id]!, to = target[id]!, style = GRAIN_STYLE[id]!, part = Math.floor(id / GRAINS_PER_PART);
    const { progress, eased, envelope } = parts[part]!;
    const a = from as SurfacePoint, b = to as SurfacePoint;
    const nx = mix(pose.from === "bed" ? 0 : a.nx, pose.to === "bed" ? 0 : b.nx, eased);
    const ny = mix(pose.from === "bed" ? 1 : a.ny, pose.to === "bed" ? 1 : b.ny, eased);
    const nz = mix(pose.from === "bed" ? 0 : a.nz, pose.to === "bed" ? 0 : b.nz, eased);
    const n = normal(vec(nx, ny, nz));
    const point = pose.from === pose.to ? from : transported(from, to, progress, eased, envelope, id);
    return { x: point.x, y: point.y, z: point.z, nx: n.x, ny: n.y, nz: n.z, id,
      part, sampleIndex: id % GRAINS_PER_PART,
      seed: style.seed, radius: style.radius, protected: PROTECTED[id]!,
      drawn: fidelity === "full" || PROTECTED[id]! || id % 2 === 0 };
  }));
}
const HOLD_GRAINS = Object.freeze(Object.fromEntries((["full", "reduced"] as const).map(fidelity => [fidelity,
  Object.freeze(Object.fromEntries((["bed", "seed", "tree", "citadel"] as const).map(form => [form,
    Object.freeze(sampleGrains({ phase: form, from: form, to: form, progress: form === "bed" ? 0 : 1 }, fidelity).map(grain => Object.freeze(grain))),
  ]))),
])) as Record<FormsInput["fidelity"], Record<FormName | "bed", readonly FormGrain[]>>);
const GROUND_BY_FIDELITY = Object.freeze(Object.fromEntries((["full", "reduced"] as const).map(fidelity => [fidelity,
  Object.freeze(GROUND.map((grain, id) => Object.freeze({ ...grain, drawn: fidelity === "full" || id % 2 === 0 }))),
])) as Record<FormsInput["fidelity"], readonly GroundGrain[]>);
const DRAWN_COUNTS = Object.freeze(Object.fromEntries((["full", "reduced"] as const).map(fidelity => [fidelity,
  HOLD_GRAINS[fidelity].seed.filter(grain => grain.drawn).length + GROUND_BY_FIDELITY[fidelity].filter(grain => grain.drawn).length,
])) as Record<FormsInput["fidelity"], number>);

export function sampleForms(input: Readonly<FormsInput>, clock: Readonly<{ seconds: number; frame?: number }>): FormsSnapshot {
  if (!Number.isFinite(clock.seconds)) throw new RangeError("Forms time must be finite");
  let seconds = clamp(clock.seconds, 0, FORMS_SECONDS);
  if (input.live && input.reducedMotion) seconds = seconds < 6 ? 4.5 : seconds < 14 ? 12.5 : seconds < 22 ? 20.5 : 28.5;
  const pose = formsPose(seconds);
  const grains = pose.from === pose.to ? HOLD_GRAINS[input.fidelity][pose.from] : sampleGrains(pose, input.fidelity);
  return Object.freeze({ ...pose, seconds, frame: clock.frame ?? Math.round(seconds * 30), inputVersion: input.inputVersion, fidelity: input.fidelity,
    grains, ground: GROUND_BY_FIDELITY[input.fidelity], followedIds: FOLLOWED_IDS,
    logicalGrains: TRANSPORT_COUNT + GROUND_COUNT, drawnGrains: DRAWN_COUNTS[input.fidelity] });
}

const OBSERVED_GRAINS = new WeakMap<readonly FormGrain[], {
  finite: boolean; uniqueIds: number; parts: readonly number[]; followedVisible: number;
  followedFrontFacing: number; maximumHeight: number; atSeed: boolean;
}>();
const TREE_READABILITY = Object.freeze({
  targetTreePrimaryTips: TREE_PRIMARY_TIPS.length,
  targetTreeMaximumTerminalsPerLimb: Math.max(...TREE_LIMB_TERMINAL_COUNTS),
  targetTreeTipSeparation4K: measureTreeTipSeparation(),
  targetTreeForkDirectionDegrees: measureTreeForkDirections().minimumDegrees,
  targetTreeElbowGap4K: measureTreeForkDirections().minimumElbowGap4K,
  targetTowerHorizontalCenterSeparation4K: measureTowerHorizontalSeparation(),
});
export function observeForms(snapshot: FormsSnapshot) {
  let summary = OBSERVED_GRAINS.get(snapshot.grains);
  if (!summary) {
    let finite = true, maximumHeight = -Infinity, followedVisible = 0, followedFrontFacing = 0, atSeed = true;
    const ids = new Set<number>(), parts = Array.from({ length: PART_COUNT }, () => 0);
    for (const grain of snapshot.grains) {
      finite &&= Number.isFinite(grain.x) && Number.isFinite(grain.y) && Number.isFinite(grain.z) && Number.isFinite(grain.nx) && Number.isFinite(grain.ny) && Number.isFinite(grain.nz);
      ids.add(grain.id); parts[grain.part] = (parts[grain.part] ?? 0) + 1;
      maximumHeight = Math.max(maximumHeight, grain.y);
      const seed = FORM_TARGETS.seed[grain.id];
      atSeed &&= !!seed && grain.x === seed.x && grain.y === seed.y && grain.z === seed.z;
      if (FOLLOW_SET.has(grain.id)) {
        if (grain.drawn) followedVisible++;
        if (projectForms(vec(grain.nx, grain.ny, grain.nz), 1).z > .05) followedFrontFacing++;
      }
    }
    summary = { finite, uniqueIds: ids.size, parts: Object.freeze(parts), followedVisible, followedFrontFacing, maximumHeight, atSeed };
    OBSERVED_GRAINS.set(snapshot.grains, summary);
  }
  const { atSeed, ...observed } = summary;
  return { seconds: snapshot.seconds, inputVersion: snapshot.inputVersion, phase: snapshot.phase, from: snapshot.from, to: snapshot.to,
    progress: snapshot.progress, logicalGrains: snapshot.logicalGrains, drawnGrains: snapshot.drawnGrains,
    ...observed, parts: [...observed.parts], ...TREE_READABILITY, returnedSeed: snapshot.phase === "seed" && atSeed };
}

export function validateFormsSnapshot(snapshot: FormsSnapshot): readonly string[] {
  const failures: string[] = [];
  if (snapshot.grains.length !== TRANSPORT_COUNT || new Set(snapshot.grains.map(grain => grain.id)).size !== TRANSPORT_COUNT) failures.push("transport-population");
  if (snapshot.ground.length !== GROUND_COUNT || new Set(snapshot.ground.map(grain => grain.id)).size !== GROUND_COUNT) failures.push("ground-population");
  if (snapshot.grains.some(grain => grain.part !== Math.floor(grain.id / GRAINS_PER_PART))) failures.push("semantic-part");
  if (!snapshot.grains.every(grain => [grain.x, grain.y, grain.z, grain.nx, grain.ny, grain.nz].every(Number.isFinite))) failures.push("finite");
  const pose = formsPose(snapshot.seconds);
  if (snapshot.phase !== pose.phase || snapshot.from !== pose.from || snapshot.to !== pose.to || snapshot.progress !== pose.progress) failures.push("authored-clock");
  // Test/review oracle only. The live paint path does not repeat this work.
  if (snapshot.grains.some(grain => {
    const from = pose.from === "bed" ? BED[grain.id] : FORM_TARGETS[pose.from][grain.id];
    const to = pose.to === "bed" ? BED[grain.id] : FORM_TARGETS[pose.to][grain.id];
    if (!from || !to) return true;
    const expected = pose.from === pose.to ? from : transportPosition(from, to, formsPartProgress(pose, grain.part), grain.id);
    return Math.hypot(grain.x - expected.x, grain.y - expected.y, grain.z - expected.z) > 1e-7;
  })) failures.push("continuous-pose");
  return failures;
}

export const FORMS_SOUND_CUES = Object.freeze([
  { id: "gather", at: .5, duration: 2.5, material: "porcelain" },
  { id: "seed-held", at: 3, duration: 3, material: "porcelain" },
  { id: "seed-tree", at: 6, duration: 5, material: "porcelain" },
  { id: "tree-held", at: 11, duration: 3, material: "porcelain" },
  { id: "tree-citadel", at: 14, duration: 5, material: "stone" },
  { id: "citadel-held", at: 19, duration: 3, material: "stone" },
  { id: "citadel-seed", at: 22, duration: 5, material: "porcelain" },
  { id: "seed-returned", at: 27, duration: 3, material: "porcelain" },
] as const);

export interface Quantiles { median: number; p95: number; p99: number; max: number }
function quantiles(values: readonly number[]): Quantiles {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.ceil((sorted.length - 1) * p)]!;
  return { median: at(.5), p95: at(.95), p99: at(.99), max: sorted.at(-1)! };
}
export interface TransportMeasurement {
  readonly from: FormName;
  readonly to: FormName;
  readonly endpointWorld: Quantiles;
  readonly pathWorld: Quantiles;
  /** Per-grain maximum adjacent-frame movement over the actual five-second morph. */
  readonly peakStep4K: Quantiles;
  readonly longestIds: readonly number[];
  readonly partMismatch: number;
}
function measurePair(fromName: FormName, toName: FormName, from: readonly SurfacePoint[], to: readonly SurfacePoint[], staggerSeconds = 0): TransportMeasurement {
  const endpoints: number[] = [], paths: number[] = [], steps: number[] = [];
  let mismatches = 0;
  for (let id = 0; id < TRANSPORT_COUNT; id++) {
    const a = from[id]!, b = to[id]!;
    endpoints.push(length(minus(a, b)));
    if (a.part !== b.part) mismatches++;
    // Candidate staggering assigns both matchers the same source-part schedule.
    const delay = staggerSeconds * (a.part === 0 ? 5 : a.part - 1);
    const scheduled = (progress: number) => clamp((progress * 5 - delay) / (5 - delay));
    let previous: Vec3 = a, path = 0;
    // A documented numerical integral, independent of playback history.
    for (let sample = 1; sample <= 64; sample++) {
      const position = transportPosition(a, b, scheduled(sample / 64), id);
      path += length(minus(position, previous)); previous = position;
    }
    paths.push(path);
    const start = fromName === "seed" ? 6 : fromName === "tree" ? 14 : 22;
    const firstFrame = Math.floor(start / FORMS_SECONDS * 899);
    const lastFrame = Math.ceil((start + 5) / FORMS_SECONDS * 899);
    let previousScreen = projectForms(a, .94 * 3), maxStep = 0;
    for (let frame = firstFrame + 1; frame <= lastFrame; frame++) {
      const local = clamp((frame / 899 * FORMS_SECONDS - start) / 5);
      const screen = projectForms(transportPosition(a, b, scheduled(local), id), .94 * 3);
      maxStep = Math.max(maxStep, Math.hypot(screen.x - previousScreen.x, screen.y - previousScreen.y)); previousScreen = screen;
    }
    steps.push(maxStep);
  }
  return { from: fromName, to: toName, endpointWorld: quantiles(endpoints), pathWorld: quantiles(paths), peakStep4K: quantiles(steps),
    longestIds: endpoints.map((distance, id) => ({ distance, id })).sort((a, b) => b.distance - a.distance || a.id - b.id).slice(0, 20).map(item => item.id), partMismatch: mismatches };
}
export function measureFormsTransport(options: { staggerSeconds?: number } = {}) {
  const staggerSeconds = options.staggerSeconds ?? PART_STAGGER_SECONDS;
  if (staggerSeconds < 0 || staggerSeconds >= 1) throw new RangeError("Candidate part staggering must leave positive morph duration");
  const global = Object.fromEntries((["seed", "tree", "citadel"] as const).map(form => [form, sortedMorton(RAW_FORMS[form])])) as Record<FormName, readonly SurfacePoint[]>;
  return { worldSize: WORLD_SIZE, fps: 30, totalFrames: 900, authoredClock: "frame / 899 * 30 seconds", canvas: { width: 3840, height: 2160 }, pathIntegrationSamples: 64, staggerSeconds, timingScope: staggerSeconds === PART_STAGGER_SECONDS ? "actual canonical limbs I–V then core; fixed five-second endpoint; same source-part schedule for global matcher" : "candidate timing; same source-part schedule for global matcher",
    transitions: ([["seed", "tree"], ["tree", "citadel"], ["citadel", "seed"]] as const).map(([from, to]) => ({
      semanticParts: measurePair(from, to, FORM_TARGETS[from], FORM_TARGETS[to], staggerSeconds),
      globalMorton: measurePair(from, to, global[from], global[to], staggerSeconds),
    })),
  };
}
