import { vector, type MediaElement } from "@foxworth/superimg";

// World y points up. Streets are real open corridors through this granular city.
// Every sample has a durable location and seed; no frame accumulates state.
const TAU = Math.PI * 2;
const BUILDING_GRAINS = 800;
const BED_GRAINS = 1_800;
const ROUTE_GRAINS = 1_300;
const DEPTHS = 16;
const COPPER_COLORS = 13;
const COLORS = 16;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const smooth = (p: number) => { const q = clamp(p); return q * q * (3 - 2 * q); };
const ease = (p: number) => { const q = clamp(p); return q < .5 ? 4 * q ** 3 : 1 - (-2 * q + 2) ** 3 / 2; };

function hash(index: number, salt = 0): number {
  let x = (index + 1 + salt * 10_003) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
}

interface Point { x: number; z: number }
interface Vec3 extends Point { y: number }
interface Building { x: number; z: number; w: number; d: number; h: number }
interface Grain extends Vec3 {
  nx: number; ny: number; nz: number;
  bx: number; bz: number; seed: number; sparkle: number;
  size: number; building: number; tier: number;
}

export const CITY_ROUTE: readonly Point[] = [
  { x: 0, z: 345 }, { x: 0, z: 120 }, { x: -120, z: 120 },
  { x: -120, z: -120 }, { x: 120, z: -120 }, { x: 120, z: -285 },
];

// Rounded corners preserve the street layout while allowing a calm camera turn.
const route: { x: number; z: number; distance: number }[] = [];
function addRoutePoint(x: number, z: number) {
  const last = route[route.length - 1];
  route.push({ x, z, distance: last ? last.distance + Math.hypot(x - last.x, z - last.z) : 0 });
}
addRoutePoint(CITY_ROUTE[0]!.x, CITY_ROUTE[0]!.z);
for (let i = 1; i < CITY_ROUTE.length - 1; i++) {
  const a = CITY_ROUTE[i - 1]!, b = CITY_ROUTE[i]!, c = CITY_ROUTE[i + 1]!;
  const before = Math.hypot(a.x - b.x, a.z - b.z);
  const after = Math.hypot(c.x - b.x, c.z - b.z);
  const radius = 24;
  const start = { x: b.x + (a.x - b.x) / before * radius, z: b.z + (a.z - b.z) / before * radius };
  const end = { x: b.x + (c.x - b.x) / after * radius, z: b.z + (c.z - b.z) / after * radius };
  addRoutePoint(start.x, start.z);
  for (let j = 1; j <= 24; j++) {
    const t = j / 24, q = 1 - t;
    addRoutePoint(q * q * start.x + 2 * q * t * b.x + t * t * end.x, q * q * start.z + 2 * q * t * b.z + t * t * end.z);
  }
}
addRoutePoint(CITY_ROUTE[CITY_ROUTE.length - 1]!.x, CITY_ROUTE[CITY_ROUTE.length - 1]!.z);
const ROUTE_LENGTH = route[route.length - 1]!.distance;

function sampleRoute(distance: number): Point {
  const d = Math.max(0, Math.min(ROUTE_LENGTH, distance));
  let low = 0, high = route.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (route[middle]!.distance < d) low = middle; else high = middle;
  }
  const a = route[low]!, b = route[high]!;
  const p = (d - a.distance) / Math.max(.001, b.distance - a.distance);
  return { x: mix(a.x, b.x, p), z: mix(a.z, b.z, p) };
}

function travelProgress(seconds: number): number {
  const t = clamp((seconds - 7) / 10);
  // Short acceleration/deceleration tails; steady speed through the canyons.
  return clamp((t < .08 ? t * t / .16 : t > .92 ? .92 - (1 - t) ** 2 / .16 : t - .04) / .92);
}

export function getNavigation(seconds: number) {
  const progress = travelProgress(seconds);
  const distance = progress * ROUTE_LENGTH;
  const position = sampleRoute(distance);
  const before = sampleRoute(distance - 10), ahead = sampleRoute(distance + 22);
  const heading = Math.atan2(ahead.x - before.x, ahead.z - before.z);
  const turns = CITY_ROUTE.slice(1, -1).map((corner, i) => {
    const a = CITY_ROUTE[i]!, c = CITY_ROUTE[i + 2]!;
    const cross = (corner.x - a.x) * (c.z - corner.z) - (corner.z - a.z) * (c.x - corner.x);
    const index = 1 + i * 25 + 12;
    return { distance: route[index]!.distance, direction: cross < 0 ? "left" as const : "right" as const };
  });
  const next = turns.find(turn => turn.distance > distance + 8);
  return {
    progress, position, heading,
    nextTurn: progress > .985 ? "arrived" as const : next?.direction ?? "straight" as const,
    remaining: ROUTE_LENGTH - distance,
    nextTurnDistance: next ? Math.max(0, next.distance - distance) : ROUTE_LENGTH - distance,
  };
}

const buildings: readonly Building[] = Array.from({ length: 24 }, (_, i) => {
  const column = i % 4, row = Math.floor(i / 4);
  return {
    x: (column - 1.5) * 120, z: (row - 2.5) * 120,
    w: 76 + hash(i, 2) * 13, d: 78 + hash(i, 3) * 12,
    h: 62 + hash(i, 5) * 112 + (column === 1 && row === 2 ? 25 : 0),
  };
});

const grains: readonly Grain[] = buildings.flatMap((building, b) => Array.from({ length: BUILDING_GRAINS }, (_, j) => {
  const i = b * BUILDING_GRAINS + j;
  const sideArea = 2 * (building.w + building.d) * building.h;
  const roofArea = building.w * building.d;
  const face = hash(i, 7) * (sideArea + roofArea);
  const u = (j * .618033988749895 + hash(i, 11) * .045) % 1;
  const v = hash(i, 13);
  let x = 0, y = v * building.h, z = 0, nx = 0, ny = 0, nz = 0;
  if (face < building.w * building.h) { x = (u - .5) * building.w; z = building.d / 2; nz = 1; }
  else if (face < 2 * building.w * building.h) { x = (u - .5) * building.w; z = -building.d / 2; nz = -1; }
  else if (face < 2 * building.w * building.h + building.d * building.h) { x = building.w / 2; z = (u - .5) * building.d; nx = 1; }
  else if (face < sideArea) { x = -building.w / 2; z = (u - .5) * building.d; nx = -1; }
  else { x = (u - .5) * building.w; z = (v - .5) * building.d; y = building.h; ny = 1; }
  const rough = (hash(i, 17) - .5) * .9;
  return {
    x: building.x + x + nx * rough, y: y + ny * rough, z: building.z + z + nz * rough,
    nx, ny, nz, bx: building.x + (hash(i, 19) - .5) * (building.w + 42),
    bz: building.z + (hash(i, 23) - .5) * (building.d + 40),
    seed: hash(i, 29), sparkle: hash(i, 31), size: 1.05 + hash(i, 37) * .75,
    building: b, tier: y / building.h,
  };
}));

const bed = Array.from({ length: BED_GRAINS }, (_, i) => ({
  x: (hash(i, 41) - .5) * 510, z: (hash(i, 43) - .5) * 770,
  size: .6 + hash(i, 47) * .65, seed: hash(i, 53),
}));
const routeGrains = Array.from({ length: ROUTE_GRAINS }, (_, i) => {
  const distance = (i + hash(i, 59)) / ROUTE_GRAINS * ROUTE_LENGTH;
  const p = sampleRoute(distance), a = sampleRoute(distance + 1), b = sampleRoute(distance - 1);
  const angle = Math.atan2(a.x - b.x, a.z - b.z), offset = (hash(i, 61) - .5) * 5;
  return { x: p.x + Math.cos(angle) * offset, z: p.z - Math.sin(angle) * offset, distance, seed: hash(i, 67) };
});

const PALETTE = Array.from({ length: COPPER_COLORS }, (_, i) => {
  const p = i / (COPPER_COLORS - 1);
  const start = p < .38 ? [22, 38, 40] : p < .76 ? [101, 75, 49] : [199, 146, 87];
  const end = p < .38 ? [101, 75, 49] : p < .76 ? [199, 146, 87] : [253, 226, 179];
  const t = p < .38 ? p / .38 : p < .76 ? (p - .38) / .38 : (p - .76) / .24;
  return `rgb(${start.map((channel, index) => Math.round(mix(channel, end[index]!, t))).join(",")})`;
}).concat(["#345f62", "#67aeb2", "#a9eff0"]);

interface Camera extends Vec3 { target: Vec3 }
const overview: Camera = { x: 490, y: 650, z: 700, target: { x: 0, y: 34, z: 0 } };
function sampleCameraRoute(distance: number): Point {
  if (distance <= ROUTE_LENGTH) return sampleRoute(distance);
  const end = CITY_ROUTE[CITY_ROUTE.length - 1]!, before = CITY_ROUTE[CITY_ROUTE.length - 2]!;
  const dx = end.x - before.x, dz = end.z - before.z, length = Math.hypot(dx, dz);
  return { x: end.x + dx / length * (distance - ROUTE_LENGTH), z: end.z + dz / length * (distance - ROUTE_LENGTH) };
}
function streetCamera(seconds: number): Camera {
  const navigation = getNavigation(seconds);
  const distance = navigation.progress * ROUTE_LENGTH;
  const p = sampleRoute(distance), ahead = sampleCameraRoute(distance + 45), before = sampleRoute(distance - 15);
  const dx = ahead.x - before.x, dz = ahead.z - before.z, length = Math.hypot(dx, dz) || 1;
  // The eye follows the rounded road while the look-ahead anticipates each turn.
  return { x: p.x - dx / length * 12, y: 34, z: p.z - dz / length * 12, target: { x: ahead.x, y: 10, z: ahead.z } };
}
function cameraAt(seconds: number): Camera {
  const street = streetCamera(seconds < 7 ? 7 : seconds > 17 ? 17 : seconds);
  // On departure, rise inside the open street before translating over roofs.
  // A straight lerp from eye height to the overview would cross a corner tower.
  const lift = ease((seconds - 17) / 2);
  const p = seconds < 7 ? ease((seconds - 5) / 2) : seconds < 17 ? 1 : 1 - ease((seconds - 17.6) / 1.4);
  const eyeY = seconds >= 17 ? mix(street.y, overview.y, lift) : mix(overview.y, street.y, p);
  // Ease the gaze down toward the rooftops as the eye rises out of the street.
  const streetTargetY = street.target.y + (seconds >= 17 ? (eyeY - street.y) * (1 - ease((seconds - 17) / 1.4)) : 0);
  return {
    x: mix(overview.x, street.x, p), y: eyeY, z: mix(overview.z, street.z, p),
    target: { x: mix(overview.target.x, street.target.x, p), y: mix(overview.target.y, streetTargetY, p), z: mix(overview.target.z, street.target.z, p) },
  };
}

function occluded(camera: Vec3, point: Vec3, skip: number): boolean {
  const dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
  for (let i = 0; i < buildings.length; i++) {
    if (i === skip) continue;
    const b = buildings[i]!;
    let near = 0, far = .997;
    const bounds = [[camera.x, dx, b.x - b.w / 2, b.x + b.w / 2], [camera.y, dy, 0, b.h], [camera.z, dz, b.z - b.d / 2, b.z + b.d / 2]];
    for (const [origin, delta, low, high] of bounds) {
      if (Math.abs(delta!) < .000001) { if (origin! < low! || origin! > high!) { far = -1; break; } }
      else {
        const a = (low! - origin!) / delta!, c = (high! - origin!) / delta!;
        near = Math.max(near, Math.min(a, c)); far = Math.min(far, Math.max(a, c));
        if (near > far) break;
      }
    }
    if (near <= far && far > .001 && near < .997) return true;
  }
  return false;
}

function facet(x: number, y: number, radius: number, seed: number): string {
  const rx = radius * (.86 + seed * .25), ry = radius * (.78 + seed * .32);
  return `M${(x - rx).toFixed(1)},${y.toFixed(1)}l${rx.toFixed(1)},${(-ry).toFixed(1)}l${rx.toFixed(1)},${ry.toFixed(1)}l${(-rx).toFixed(1)},${ry.toFixed(1)}Z`;
}

// Clip in view space before dividing by depth; no face can explode when it
// crosses the eye. The same helper clips projected polygons to the frame.
function clipPlane(points: readonly Vec3[], axis: keyof Vec3, bound: number, above: boolean): Vec3[] {
  const output: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const aIn = above ? a[axis] >= bound : a[axis] <= bound;
    const bIn = above ? b[axis] >= bound : b[axis] <= bound;
    if (aIn) output.push(a);
    if (aIn !== bIn) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      output.push({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });
    }
  }
  return output;
}

const MATTE = ["#2c3431", "#6a5038", "#9b7750"];

export interface CityFrame { seconds: number; width: number; height: number; assembly: number; collapse: number }
/** Author-reported geometry facts; these do not measure captured pixel coverage. */
export interface CityObservation {
  camera: { eye: Vec3; target: Vec3; insideBuilding: boolean; finite: boolean; pitchDegrees: number };
  grains: { total: number; visibleBuilding: number; visibleRoof: number; visibleRoute: number; maximumHeight: number };
  navigation: ReturnType<typeof getNavigation>;
  material: { assembly: number; collapse: number };
}

function sampleCity(frame: CityFrame): { nodes: MediaElement[]; observation: CityObservation } {
  const { seconds, width, height, assembly, collapse } = frame;
  const camera = cameraAt(seconds), scale = Math.min(width / 1280, height / 720);
  const delta = { x: camera.target.x - camera.x, y: camera.target.y - camera.y, z: camera.target.z - camera.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  const forward = { x: delta.x / length, y: delta.y / length, z: delta.z / length };
  const horizontal = Math.hypot(forward.x, forward.z);
  const right = { x: -forward.z / horizontal, z: forward.x / horizontal };
  const up = { x: -right.z * forward.y, y: right.z * forward.x - right.x * forward.z, z: right.x * forward.y };
  const focal = width * .76, cx = width * .5, cy = height * .475;
  const bins = Array.from({ length: DEPTHS * COLORS }, () => "");
  const faceBins = Array.from({ length: DEPTHS * MATTE.length }, () => "");
  const faceCover = smooth((assembly - .82) / .18) * (1 - smooth(collapse / .16));
  let visibleBuilding = 0, visibleRoof = 0, visibleRoute = 0, maximumHeight = 0;
  const view = (point: Vec3): Vec3 => {
    const dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
    return { x: dx * right.x + dz * right.z, y: dx * up.x + dy * up.y + dz * up.z, z: dx * forward.x + dy * forward.y + dz * forward.z };
  };
  if (faceCover > .00001) for (const building of buildings) {
    const x0 = building.x - building.w / 2, x1 = building.x + building.w / 2;
    const z0 = building.z - building.d / 2, z1 = building.z + building.d / 2, y = building.h;
    const faces = [
      { normal: { x: 0, y: 0, z: 1 }, points: [{ x: x0, y: 0, z: z1 }, { x: x1, y: 0, z: z1 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }] },
      { normal: { x: 0, y: 0, z: -1 }, points: [{ x: x1, y: 0, z: z0 }, { x: x0, y: 0, z: z0 }, { x: x0, y, z: z0 }, { x: x1, y, z: z0 }] },
      { normal: { x: 1, y: 0, z: 0 }, points: [{ x: x1, y: 0, z: z1 }, { x: x1, y: 0, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }] },
      { normal: { x: -1, y: 0, z: 0 }, points: [{ x: x0, y: 0, z: z0 }, { x: x0, y: 0, z: z1 }, { x: x0, y, z: z1 }, { x: x0, y, z: z0 }] },
      { normal: { x: 0, y: 1, z: 0 }, points: [{ x: x0, y, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }] },
    ];
    for (const face of faces) {
      const n = face.normal, anchor = face.points[0]!;
      if (n.x * (camera.x - anchor.x) + n.y * (camera.y - anchor.y) + n.z * (camera.z - anchor.z) <= 0) continue;
      const shade = Math.min(MATTE.length - 1, Math.floor(clamp(.25 + Math.max(0, n.x * -.55 + n.y * .8 + n.z * .37) * .8) * MATTE.length));
      const projected = face.points.map(view);
      // Slice the actual polygon at each grain depth boundary: nearby planes
      // and far grains share the same painter order even along long facades.
      for (let slice = 0; slice < DEPTHS; slice++) {
        const near = 16 * (1900 / 16) ** (slice / DEPTHS), far = 16 * (1900 / 16) ** ((slice + 1) / DEPTHS);
        let polygon = clipPlane(clipPlane(projected, "z", near, true), "z", far, false);
        polygon = polygon.map(p => ({ x: cx + p.x * focal / p.z, y: cy - p.y * focal / p.z, z: p.z }));
        polygon = clipPlane(clipPlane(clipPlane(clipPlane(polygon, "x", -1, true), "x", width + 1, false), "y", -1, true), "y", height + 1, false);
        if (polygon.length < 3) continue;
        const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
        if (Math.max(...xs) - Math.min(...xs) < 1 || Math.max(...ys) - Math.min(...ys) < 1) continue;
        faceBins[(DEPTHS - 1 - slice) * MATTE.length + shade] += `M${polygon.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z`;
      }
    }
  }
  // Material visibility acquires/releases across stable individual seeds.
  // A single solid-city boolean would hide thousands of grains in one frame.
  const structuralCover = smooth((assembly - .91) / .09) * (1 - smooth(collapse / .12));
  const add = (point: Vec3, size: number, seed: number, tone: number, skip = -1) => {
    const dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
    const depth = dx * forward.x + dy * forward.y + dz * forward.z;
    if (depth < 16 || depth > 1900) return false;
    const x = cx + (dx * right.x + dz * right.z) * focal / depth;
    const y = cy - (dx * up.x + dy * up.y + dz * up.z) * focal / depth;
    if (x < -12 || x > width + 12 || y < -12 || y > height + 12) return false;
    if (seed < structuralCover && occluded(camera, point, skip)) return false;
    const slice = Math.min(DEPTHS - 1, Math.floor(clamp(Math.log(depth / 16) / Math.log(1900 / 16)) * DEPTHS));
    const radius = Math.max(.8, Math.min(4 * scale, size * focal / depth));
    bins[(DEPTHS - 1 - slice) * COLORS + tone] += facet(x, y, radius, seed);
    return true;
  };
  for (const grain of bed) add({ x: grain.x, y: .2, z: grain.z }, grain.size, grain.seed, 1 + Math.floor(grain.seed * 3));
  for (const grain of grains) {
    const wave = clamp((grain.z + 340) / 680);
    const arrive = ease((assembly - wave * .21 - grain.seed * .2) / .57);
    const depart = ease((collapse - (1 - grain.tier) * .27 - grain.seed * .18) / .52);
    const held = arrive * (1 - depart);
    // A rising wave makes architecture, then wind peels its grains from the top.
    const travel = Math.sin(held * Math.PI);
    const point = {
      x: mix(grain.bx, grain.x, held) + travel * Math.sin(grain.seed * TAU) * 13 + depart * 48,
      y: mix(.45 + grain.seed * 1.2, grain.y, held) + travel * (8 + grain.seed * 10) + Math.sin(depart * Math.PI) * (10 + grain.seed * 24),
      z: mix(grain.bz, grain.z, held) + travel * Math.cos(grain.seed * TAU) * 11 + depart * (grain.seed - .5) * 37,
    };
    maximumHeight = Math.max(maximumHeight, point.y);
    if (grain.seed < structuralCover && grain.nx * (camera.x - point.x) + grain.ny * (camera.y - point.y) + grain.nz * (camera.z - point.z) < 0) continue;
    const diffuse = Math.max(0, grain.nx * -.55 + grain.ny * .8 + grain.nz * .37);
    // Irregular courses suggest windows without converting grains into a grid.
    const course = Math.pow(.5 + .5 * Math.cos(grain.y / 9 * TAU), 12) * (grain.ny ? 0 : .1);
    const buildingTone = .27 + diffuse * .58 + grain.sparkle ** 7 * .17 - course;
    const tone = Math.min(COPPER_COLORS - 1, Math.floor(clamp(mix(.16 + grain.sparkle * .2, buildingTone, held) + (grain.seed - .5) / COPPER_COLORS) * COPPER_COLORS));
    if (add(point, grain.size, grain.seed, tone, grain.building)) {
      visibleBuilding++;
      if (grain.ny > 0) visibleRoof++;
    }
  }
  const navigation = getNavigation(seconds), traveled = navigation.progress * ROUTE_LENGTH;
  const routeVisible = smooth((assembly - .3) / .5) * (1 - smooth(collapse / .85));
  if (routeVisible > .001) for (const grain of routeGrains) {
    const lead = grain.distance - traveled;
    const pulse = .5 + .5 * Math.cos(lead / 33 - seconds * 1.3);
    const tone = lead < -12 ? 13 : pulse > .72 ? 15 : 14;
    if (add({ x: grain.x + collapse * Math.sin(grain.seed * TAU) * 26, y: .9 + collapse * grain.seed * 12, z: grain.z }, 1.2 + grain.seed * .45, grain.seed, tone)) visibleRoute++;
  }
  const nodes: MediaElement[] = [];
  for (let depth = 0; depth < DEPTHS; depth++) {
    for (let shade = 0; shade < MATTE.length; shade++) {
      const index = depth * MATTE.length + shade, d = faceBins[index]!;
      nodes.push(vector.path({ id: `city-matte-${index}`, d: d || "M0,0h1v1h-1Z", fill: MATTE[shade], opacity: d ? faceCover * .38 : 0 }));
    }
    for (let color = 0; color < COLORS; color++) {
      const index = depth * COLORS + color, d = bins[index]!;
      nodes.push(vector.path({ id: `city-grains-${index}`, d: d || "M0,0h1v1h-1Z", fill: PALETTE[color], opacity: d ? color >= COPPER_COLORS ? routeVisible : 1 : 0 }));
    }
  }
  return {
    nodes,
    observation: {
      camera: {
        eye: { x: camera.x, y: camera.y, z: camera.z }, target: { ...camera.target },
        insideBuilding: buildings.some(b => camera.y > 0 && camera.y < b.h && Math.abs(camera.x - b.x) < b.w / 2 && Math.abs(camera.z - b.z) < b.d / 2),
        finite: [camera.x, camera.y, camera.z, camera.target.x, camera.target.y, camera.target.z, length, horizontal].every(Number.isFinite) && length > 0 && horizontal > 0,
        pitchDegrees: Math.atan2(-forward.y, horizontal) * 180 / Math.PI,
      },
      grains: { total: grains.length + BED_GRAINS + ROUTE_GRAINS, visibleBuilding, visibleRoof, visibleRoute, maximumHeight },
      navigation,
      material: { assembly, collapse },
    },
  };
}

export function renderCity(frame: CityFrame): MediaElement[] { return sampleCity(frame).nodes; }
export function inspectCity(frame: CityFrame): CityObservation { return sampleCity(frame).observation; }

export const cityGrainCount = grains.length + BED_GRAINS + ROUTE_GRAINS;
