import { ATLAS_ROUTE_LENGTH, routeAtDistance } from "./route";

export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }
export type AtlasLandmark = "causeway" | "cistern" | "archive";
export interface AtlasMass {
  readonly id: string;
  readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number;
  readonly firstEra: number;
  readonly landmark?: AtlasLandmark;
  readonly shape: "box" | "ring" | "split-octagon";
  readonly raisedX: number; readonly raisedZ: number;
  readonly terrace?: boolean;
}
export interface AtlasGrain {
  readonly id: number;
  readonly role: "architecture" | "bed" | "route";
  readonly mass: number;
  readonly local: Vec3;
  readonly normal: Vec3;
  readonly bed: Vec3;
  readonly trace: Vec3;
  readonly seed: number;
  readonly sparkle: number;
  readonly size: number;
  readonly protected: boolean;
  readonly reduced: boolean;
  readonly routeDistance: number;
  readonly bedRegion?: "tide" | "land" | "water";
  readonly coastPhase?: number;
}
const TAU = Math.PI * 2;
export const ATLAS_POPULATION = Object.freeze({ architecture: 20_000, bed: 2_000, route: 2_000, total: 24_000 });
export const ATLAS_SEED = "aster-basin-v1";
export function atlasHash(index: number, salt = 0): number {
  let x = (index + 1 + salt * 10_003) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** A south-facing tidal island: the causeway crosses its edge at z ≈ 218. */
export const ATLAS_BASIN_CONTOUR = Object.freeze([
  [-306, 180], [-266, 231], [-176, 239], [-82, 214], [-28, 209],
  [31, 222], [124, 237], [237, 216], [283, 155], [305, 48],
  [278, -62], [275, -219], [224, -277], [122, -296], [20, -273],
  [-100, -284], [-210, -261], [-282, -190], [-312, -69], [-301, 45],
].map(([x, z]) => Object.freeze({ x: x!, z: z! })));
const coastLengths = ATLAS_BASIN_CONTOUR.map((a, i) => {
  const b = ATLAS_BASIN_CONTOUR[(i + 1) % ATLAS_BASIN_CONTOUR.length]!;
  return Math.hypot(b.x - a.x, b.z - a.z);
});
const coastLength = coastLengths.reduce((sum, length) => sum + length, 0);
export function atlasBasinContains(point: { x: number; z: number }): boolean {
  let inside = false;
  for (let i = 0, j = ATLAS_BASIN_CONTOUR.length - 1; i < ATLAS_BASIN_CONTOUR.length; j = i++) {
    const a = ATLAS_BASIN_CONTOUR[i]!, b = ATLAS_BASIN_CONTOUR[j]!;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function atlasOffsetCoast(point: { x: number; z: number }, offset: number): Vec3 {
  const length = Math.hypot(point.x, point.z + 20);
  return { x: point.x + point.x / length * offset, y: 0.32, z: point.z + (point.z + 20) / length * offset };
}
export function atlasCoastPoint(phase: number, offset = 0): Vec3 {
  let distance = ((phase % 1) + 1) % 1 * coastLength;
  for (let i = 0; i < coastLengths.length; i++) {
    const length = coastLengths[i]!;
    if (distance <= length || i === coastLengths.length - 1) {
      const a = ATLAS_BASIN_CONTOUR[i]!, b = ATLAS_BASIN_CONTOUR[(i + 1) % ATLAS_BASIN_CONTOUR.length]!;
      const t = distance / length;
      return atlasOffsetCoast({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, offset);
    }
    distance -= length;
  }
  return atlasOffsetCoast(ATLAS_BASIN_CONTOUR[0]!, offset);
}
export function atlasFutureCoast(raised: number, open: number): readonly Vec3[] {
  return ATLAS_BASIN_CONTOUR.map(point => atlasOffsetCoast(point, raised * 30 - open * 24));
}

function basinBedPoint(id: number, land: boolean): Vec3 {
  for (let attempt = 0; attempt < 256; attempt++) {
    const point = { x: (atlasHash(id, 43 + attempt * 2) - 0.5) * 720, y: 0.2, z: (atlasHash(id, 47 + attempt * 2) - 0.5) * 720 };
    if (atlasBasinContains(point) === land) return point;
  }
  throw new Error(`No basin bed point for ${id}`);
}

const ordinary: AtlasMass[] = [
  { id: "west-wharf", x: -238, z: 174, width: 52, depth: 60, height: 36, firstEra: 0, raisedX: -262, raisedZ: 172, shape: "box" },
  { id: "south-court", x: -146, z: 174, width: 52, depth: 60, height: 42, firstEra: 0, raisedX: -164, raisedZ: 252, shape: "box" },
  { id: "east-quay", x: 64, z: 174, width: 54, depth: 62, height: 46, firstEra: 0, raisedX: 64, raisedZ: 252, shape: "box" },
  { id: "southeast-quay", x: 178, z: 174, width: 66, depth: 66, height: 56, firstEra: 0, raisedX: 218, raisedZ: 252, shape: "box" },
  { id: "west-market", x: -238, z: 70, width: 50, depth: 66, height: 54, firstEra: 1, raisedX: -262, raisedZ: 64, shape: "box" },
  { id: "inner-terrace", x: -48, z: 4, width: 42, depth: 54, height: 62, firstEra: 1, raisedX: -262, raisedZ: -54, shape: "box" },
  { id: "east-terrace", x: 60, z: 16, width: 58, depth: 56, height: 68, firstEra: 1, raisedX: 262, raisedZ: -42, shape: "box" },
  { id: "east-market", x: 182, z: 28, width: 70, depth: 76, height: 78, firstEra: 1, raisedX: 262, raisedZ: 78, shape: "box" },
  { id: "northwest-terrace", x: -238, z: -82, width: 56, depth: 60, height: 64, firstEra: 2, raisedX: -262, raisedZ: -170, shape: "box", terrace: true },
  { id: "western-steps", x: -170, z: -148, width: 52, depth: 54, height: 62, firstEra: 2, raisedX: -176, raisedZ: -252, shape: "box", terrace: true },
  { id: "north-court", x: -48, z: -180, width: 46, depth: 74, height: 72, firstEra: 2, raisedX: -48, raisedZ: -252, shape: "box", terrace: true },
  { id: "northeast-court", x: 192, z: -151, width: 64, depth: 62, height: 80, firstEra: 2, raisedX: 176, raisedZ: -252, shape: "box", terrace: true },
];
const landmarks: AtlasMass[] = [
  { id: "south-causeway", x: 0, z: 234, width: 28, depth: 74, height: 3, firstEra: 0, landmark: "causeway", raisedX: 0, raisedZ: 234, shape: "box" },
  { id: "cistern-court", x: -173, z: -3, width: 68, depth: 68, height: 22, firstEra: 1, landmark: "cistern", raisedX: -173, raisedZ: -3, shape: "ring" },
  { id: "tidal-archive", x: 96, z: -219, width: 68, depth: 64, height: 58, firstEra: 2, landmark: "archive", raisedX: 96, raisedZ: -219, shape: "split-octagon" },
];
export const ATLAS_MASSES: readonly AtlasMass[] = Object.freeze([...ordinary, ...landmarks].map(mass => Object.freeze(mass)));
const counts = [...Array.from({ length: 12 }, () => 1000), 2000, 3000, 3000];

export function atlasFootprint(mass: AtlasMass): readonly { x: number; z: number }[] {
  if (mass.shape === "ring") return Array.from({ length: 49 }, (_, i) => ({ x: mass.x + Math.cos(i / 48 * TAU) * mass.width / 2, z: mass.z + Math.sin(i / 48 * TAU) * mass.depth / 2 }));
  if (mass.shape === "split-octagon") return Array.from({ length: 9 }, (_, i) => ({ x: mass.x + Math.cos((i / 8 + 0.0625) * TAU) * mass.width / 2, z: mass.z + Math.sin((i / 8 + 0.0625) * TAU) * mass.depth / 2 }));
  return [
    { x: mass.x - mass.width / 2, z: mass.z - mass.depth / 2 },
    { x: mass.x + mass.width / 2, z: mass.z - mass.depth / 2 },
    { x: mass.x + mass.width / 2, z: mass.z + mass.depth / 2 },
    { x: mass.x - mass.width / 2, z: mass.z + mass.depth / 2 },
    { x: mass.x - mass.width / 2, z: mass.z - mass.depth / 2 },
  ];
}

function boxPoint(mass: AtlasMass, id: number, j: number) {
  const upper = mass.terrace && atlasHash(id, 3) > 0.55;
  const width = mass.width * (upper ? 0.72 : 1), depth = mass.depth * (upper ? 0.72 : 1);
  const height = mass.height * (mass.terrace ? upper ? 0.42 : 0.58 : 1);
  const sideArea = 2 * (width + depth) * height;
  const face = atlasHash(id, 7) * (sideArea + width * depth);
  const u = (j * 0.618033988749895 + atlasHash(id, 11) * 0.045) % 1, v = atlasHash(id, 13);
  let x = 0, y = v, z = 0, nx = 0, ny = 0, nz = 0;
  if (face < width * height) { x = u - 0.5; z = 0.5; nz = 1; }
  else if (face < 2 * width * height) { x = u - 0.5; z = -0.5; nz = -1; }
  else if (face < 2 * width * height + depth * height) { x = 0.5; z = u - 0.5; nx = 1; }
  else if (face < sideArea) { x = -0.5; z = u - 0.5; nx = -1; }
  else {
    x = u - 0.5; z = v - 0.5; y = 1; ny = 1;
    if (mass.terrace && !upper && Math.abs(x) < 0.36 && Math.abs(z) < 0.36) {
      if (id % 2) x = (x < 0 ? -1 : 1) * (0.36 + atlasHash(id, 17) * 0.14);
      else z = (z < 0 ? -1 : 1) * (0.36 + atlasHash(id, 17) * 0.14);
    }
  }
  if (mass.terrace) { x *= upper ? 0.72 : 1; z *= upper ? 0.72 : 1; y = (upper ? 0.58 : 0) + y * (upper ? 0.42 : 0.58); }
  return { local: { x, y, z }, normal: { x: nx, y: ny, z: nz } };
}

function ringPoint(id: number, j: number) {
  const angle = (j * 0.618033988749895 % 1) * TAU;
  const side = atlasHash(id, 71), inner = side < 0.3, top = side > 0.72;
  const r = top ? 22 / 68 + atlasHash(id, 73) * 12 / 68 : inner ? 22 / 68 : 0.5;
  return {
    local: { x: Math.cos(angle) * r, y: top ? 1 : atlasHash(id, 77), z: Math.sin(angle) * r },
    normal: top ? { x: 0, y: 1, z: 0 } : { x: Math.cos(angle) * (inner ? -1 : 1), y: 0, z: Math.sin(angle) * (inner ? -1 : 1) },
  };
}

function octagonPoint(id: number, j: number) {
  const side = j % 8, t = atlasHash(id, 79);
  const a = (side / 8 + 0.0625) * TAU, b = ((side + 1) / 8 + 0.0625) * TAU;
  const top = atlasHash(id, 83) > 0.65;
  const radius = top ? Math.sqrt(atlasHash(id, 89)) : 1;
  let x = (Math.cos(a) * (1 - t) + Math.cos(b) * t) * 0.5 * radius;
  // Keep a real twelve-unit split in the roof and the front/back wall.
  if (Math.abs(x) < 6 / 68) x = Math.sign(x || (j % 2 ? 1 : -1)) * (6 / 68 + atlasHash(id, 97) * 0.025);
  return {
    local: { x, y: top ? 1 : atlasHash(id, 101), z: (Math.sin(a) * (1 - t) + Math.sin(b) * t) * 0.5 * radius },
    normal: top ? { x: 0, y: 1, z: 0 } : { x: Math.cos((a + b) / 2), y: 0, z: Math.sin((a + b) / 2) },
  };
}

function tracePoint(mass: AtlasMass, j: number, count: number): Vec3 {
  const footprint = atlasFootprint(mass);
  const phase = (j + 0.5) / count * (footprint.length - 1);
  const segment = Math.min(footprint.length - 2, Math.floor(phase)), p = phase - segment;
  const a = footprint[segment]!, b = footprint[segment + 1]!;
  return { x: a.x + (b.x - a.x) * p, y: 0.9, z: a.z + (b.z - a.z) * p };
}

const architecture: AtlasGrain[] = [];
for (let massIndex = 0; massIndex < ATLAS_MASSES.length; massIndex++) {
  const mass = ATLAS_MASSES[massIndex]!, count = counts[massIndex]!;
  for (let j = 0; j < count; j++) {
    const id = architecture.length;
    const geometry = mass.shape === "ring" ? ringPoint(id, j) : mass.shape === "split-octagon" ? octagonPoint(id, j) : boxPoint(mass, id, j);
    architecture.push(Object.freeze({
      id, role: "architecture", mass: massIndex, ...geometry,
      bed: { x: mass.x + (atlasHash(id, 19) - 0.5) * (mass.width + 36), y: 0.45 + atlasHash(id, 23), z: mass.z + (atlasHash(id, 29) - 0.5) * (mass.depth + 36) },
      trace: tracePoint(mass, j, count), seed: atlasHash(id, 31), sparkle: atlasHash(id, 37),
      size: 0.8 + atlasHash(id, 41) * 0.95,
      protected: mass.landmark !== undefined, reduced: mass.landmark !== undefined || j % 2 === 0,
      routeDistance: 0,
    }));
  }
}
const bed: AtlasGrain[] = Array.from({ length: 2000 }, (_, i) => {
  const id = 20_000 + i;
  const bedRegion = i < 800 ? "tide" : i < 1800 ? "land" : "water";
  const coastPhase = (i + atlasHash(id, 43)) / 800;
  const point = bedRegion === "tide" ? atlasCoastPoint(coastPhase, (atlasHash(id, 47) - 0.5) * 3.8) : basinBedPoint(id, bedRegion === "land");
  return Object.freeze({
    id, role: "bed" as const, mass: -1, local: point, normal: { x: 0, y: 1, z: 0 },
    bed: point, trace: point, seed: atlasHash(id, 53), sparkle: atlasHash(id, 59), size: (bedRegion === "tide" ? 1.1 : 0.55) + atlasHash(id, 61) * 0.8,
    protected: false, reduced: i % 2 === 0, routeDistance: 0,
    bedRegion, coastPhase: bedRegion === "tide" ? coastPhase : undefined,
  });
});
const route: AtlasGrain[] = Array.from({ length: 2000 }, (_, i) => {
  const id = 22_000 + i, distance = (i + atlasHash(id, 67)) / 2000 * ATLAS_ROUTE_LENGTH;
  const point = routeAtDistance(distance), ahead = routeAtDistance(distance + 1), behind = routeAtDistance(distance - 1);
  const angle = Math.atan2(ahead.x - behind.x, ahead.z - behind.z), offset = (atlasHash(id, 71) - 0.5) * 4.6;
  const local = { x: point.x + Math.cos(angle) * offset, y: 0.9, z: point.z - Math.sin(angle) * offset };
  return Object.freeze({
    id, role: "route" as const, mass: -1, local, normal: { x: 0, y: 1, z: 0 }, bed: local, trace: local,
    seed: atlasHash(id, 73), sparkle: atlasHash(id, 79), size: 0.9 + atlasHash(id, 83) * 0.45,
    protected: true, reduced: true, routeDistance: distance,
  });
});
export const ATLAS_GRAINS: readonly AtlasGrain[] = Object.freeze([...architecture, ...bed, ...route]);
