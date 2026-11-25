export interface AtlasPoint { readonly x: number; readonly z: number }
export interface AtlasRoutePoint extends AtlasPoint { readonly distance: number }
export const ATLAS_ROUTE: readonly AtlasPoint[] = Object.freeze([
  { x: 0, z: 190 }, { x: 0, z: 70 }, { x: -96, z: 70 },
  { x: -96, z: -96 }, { x: 96, z: -96 }, { x: 96, z: -160 },
].map(point => Object.freeze(point)));
export const ATLAS_CORNER_RADIUS = 24;
export const ATLAS_CORRIDOR_WIDTH = 48;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const route: AtlasRoutePoint[] = [];
const turnDistances: { distance: number; direction: "left" | "right" }[] = [];
function add(point: AtlasPoint) {
  const previous = route.at(-1);
  route.push(Object.freeze({ ...point, distance: previous ? previous.distance + Math.hypot(point.x - previous.x, point.z - previous.z) : 0 }));
}
add(ATLAS_ROUTE[0]!);
for (let i = 1; i < ATLAS_ROUTE.length - 1; i++) {
  const a = ATLAS_ROUTE[i - 1]!, b = ATLAS_ROUTE[i]!, c = ATLAS_ROUTE[i + 1]!;
  const before = Math.hypot(a.x - b.x, a.z - b.z), after = Math.hypot(c.x - b.x, c.z - b.z);
  const start = { x: b.x + (a.x - b.x) / before * ATLAS_CORNER_RADIUS, z: b.z + (a.z - b.z) / before * ATLAS_CORNER_RADIUS };
  const end = { x: b.x + (c.x - b.x) / after * ATLAS_CORNER_RADIUS, z: b.z + (c.z - b.z) / after * ATLAS_CORNER_RADIUS };
  add(start);
  for (let j = 1; j <= 24; j++) {
    const t = j / 24, q = 1 - t;
    add({ x: q * q * start.x + 2 * q * t * b.x + t * t * end.x, z: q * q * start.z + 2 * q * t * b.z + t * t * end.z });
    if (j === 12) {
      const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
      turnDistances.push({ distance: route.at(-1)!.distance, direction: cross < 0 ? "left" : "right" });
    }
  }
}
add(ATLAS_ROUTE.at(-1)!);
export const ATLAS_ROUNDED_ROUTE: readonly AtlasRoutePoint[] = Object.freeze(route);
export const ATLAS_ROUTE_LENGTH = route.at(-1)!.distance;
export const ATLAS_TURNS = Object.freeze(turnDistances.map(turn => Object.freeze({ ...turn, progress: turn.distance / ATLAS_ROUTE_LENGTH })));

export function routeAtDistance(distance: number, extend = false): AtlasPoint {
  if (extend && distance > ATLAS_ROUTE_LENGTH) return { x: 96, z: -160 - (distance - ATLAS_ROUTE_LENGTH) };
  const d = Math.max(0, Math.min(ATLAS_ROUTE_LENGTH, distance));
  let low = 0, high = route.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (route[middle]!.distance < d) low = middle; else high = middle;
  }
  const a = route[low]!, b = route[high]!;
  const p = (d - a.distance) / Math.max(0.00001, b.distance - a.distance);
  return { x: mix(a.x, b.x, p), z: mix(a.z, b.z, p) };
}

/** Camera, route grains, HUD, and minimap all consume this sampler. */
export function routeSampler(progress: number) {
  const p = clamp(progress), distance = p * ATLAS_ROUTE_LENGTH;
  const point = routeAtDistance(distance);
  const behind = routeAtDistance(distance - 4);
  const ahead = routeAtDistance(distance + 22, true);
  const next = ATLAS_TURNS.find(turn => turn.distance > distance + 6);
  return {
    progress: p, distance, point, ahead,
    heading: Math.atan2(ahead.x - behind.x, ahead.z - behind.z),
    remaining: ATLAS_ROUTE_LENGTH - distance,
    nextTurn: p >= 0.995 ? "arrived" as const : next?.direction ?? "straight" as const,
    nextTurnDistance: next ? Math.max(0, next.distance - distance) : ATLAS_ROUTE_LENGTH - distance,
  };
}

/** An affine map of the same route, not a second navigation drawing. */
export function atlasMinimapPoint(point: AtlasPoint, size = 160): { x: number; y: number } {
  return { x: (point.x + 310) / 620 * size, y: (point.z + 310) / 620 * size };
}
export function atlasMinimapRoute(size = 160): readonly { x: number; y: number }[] {
  return ATLAS_ROUNDED_ROUTE.map(point => atlasMinimapPoint(point, size));
}
