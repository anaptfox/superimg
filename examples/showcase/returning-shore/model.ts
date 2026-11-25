export type Fidelity = 'full' | 'reduced';
export interface BrushPoint { readonly x: number; readonly y: number; readonly at: number }
export interface Stroke { readonly id: string; readonly points: readonly BrushPoint[]; readonly radius: number }
export interface ShoreData {
  teaching: boolean; fidelity: Fidelity; live: boolean; logicalSeconds: number;
  inputVersion: number; reducedMotion: boolean; strokes: readonly Stroke[];
}
export const INITIAL_SHORE: ShoreData = { teaching: false, fidelity: 'full', live: true, logicalSeconds: 0, inputVersion: 0, reducedMotion: false, strokes: [] };
export const GRAIN_COUNT = 18_000;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const ease = (v: number) => { const p = clamp(v); return p * p * p * (p * (p * 6 - 15) + 10); };
export function hash(id: number, salt = 0) { let n = Math.imul(id + 1, 0x45d9f3b) ^ Math.imul(salt + 9, 0x27d4eb2d); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 4294967296; }
export function shoreline(x: number) { return -13 + 48 * Math.sin(x / 135) + 27 * Math.sin(x / 63) + 62 * Math.exp(-(((x + 180) / 80) ** 2)) - 56 * Math.exp(-(((x - 90) / 94) ** 2)); }
/** An earlier, straighter coast: its geometry does not inherit the present inlet. */
export function earlierShoreline(x: number) { return -44 + x * .12 + 9 * Math.sin((x + 140) / 210); }
const UNDERPAINT_CELLS = Array.from({ length: 60 * 24 }, (_, id) => {
 const x = -540 + (id % 60 + .5) * 18, y = -216 + (Math.floor(id / 60) + .5) * 18;
 return { x, y, width: 18, height: Math.max(0, Math.min(18, earlierShoreline(x) - (y - 9))) };
}).filter(p => p.height > 0);
export const HOME = Array.from({ length: GRAIN_COUNT }, (_, id) => {
  const x = -470 + (id % 180 + hash(id, 1)) * 940 / 180;
  const y = -212 + (Math.floor(id / 180) + hash(id, 2)) * 424 / 100;
  const edge = y - shoreline(x);
  const palette = edge < -8 ? (hash(id, 3) < .88 ? 0 : 1) : edge < 7 ? 2 : hash(id, 3) < .85 ? 3 : 4;
  return { id, x, y, protected: Math.abs(edge) < 7 || Math.abs(x) > 466 || Math.abs(y) > 208, palette, size: 2.4 + hash(id, 4) * 1.65, phase: hash(id, 5) * Math.PI * 2, tone: Math.floor(hash(id, 6) * 8) };
});
export function filmStrokes(): readonly Stroke[] {
  return [{ id: 'authored-brush', radius: .05, points: Array.from({ length: 91 }, (_, i) => ({
    x: .34 + i / 90 * .33, y: .37 + i / 90 * .22, at: 8.5 + i / 30,
  })) }];
}
export interface Impulse { x: number; y: number; radius: number; age: number }
/** Spatial index contains only unexpired impulses. Replay records are never pruned. */
function indexImpulses(strokes: readonly Stroke[], seconds: number) {
  const cells = new Map<string, Impulse[]>(); const cellSize = 96;
  for (const stroke of strokes) for (const p of stroke.points) {
    const age = seconds - p.at;
    if (age < 0 || age >= 4) continue;
    const v = { x: p.x * 1280 - 640, y: p.y * 720 - 360, radius: Math.max(8, stroke.radius * 1280), age };
    const reach = v.radius * 1.3;
    for (let y = Math.floor((v.y - reach) / cellSize); y <= Math.floor((v.y + reach) / cellSize); y++)
      for (let x = Math.floor((v.x - reach) / cellSize); x <= Math.floor((v.x + reach) / cellSize); x++) {
        const key = `${x}:${y}`; const bucket = cells.get(key) ?? []; bucket.push(v); cells.set(key, bucket);
      }
  }
  return { cells, cellSize };
}
export interface ShoreGrain { id: number; protected: boolean; x: number; y: number; homeX: number; homeY: number; displacement: number; size: number; palette: number; tone: number; exposed: number }
export interface ShoreSnapshot { seconds: number; filmSeconds: number; zoom: number; panX: number; panY: number; assembled: number; grains: ShoreGrain[]; revealImpulses: readonly Impulse[]; underpaint: { x:number;y:number;exposure:number }[]; underpaintCells: { x:number;y:number;width:number;height:number;exposure:number }[]; logicalCount: number; drawnCount: number; maxDisplacement: number; activeImpulseCount: number; inputVersion: number; fidelity: Fidelity; restored: boolean }
export function sampleShore(data: ShoreData, clock: { seconds: number }): ShoreSnapshot {
  const t = data.live ? Math.max(0, data.logicalSeconds) : Math.max(0, Math.min(24, clock.seconds));
  const strokes = data.live ? data.strokes : filmStrokes();
  const indexed = indexImpulses(strokes, t);
  const assembled = data.live ? 1 : ease(t / 2.5);
  const macro = data.live ? 0 : ease((t - 6) / 2.5) * (1 - ease((t - 15.5) / 5));
  const zoom = data.live ? 1 : (1.5 + 1.05 * macro - .64 * ease((t - 15.5) / 5));
  const panX = macro * 36, panY = macro * 15;
  let maxDisplacement = 0;
  const grains = HOME.map(g => {
    let dx = 0, dy = 0, exposed = 0;
    const impulses = indexed.cells.get(`${Math.floor(g.x / indexed.cellSize)}:${Math.floor(g.y / indexed.cellSize)}`) ?? [];
    for (const p of impulses) {
      const vx = g.x - p.x, vy = g.y - p.y, distance = Math.hypot(vx, vy), radius = p.radius * 1.3;
      if (distance >= radius) continue;
      const strength = (1 - ease(p.age / 4)) * (1 - ease(distance / radius));
      dx += (vx / Math.max(distance, 1) * 30 + 14) * strength;
      dy += (vy / Math.max(distance, 1) * 30 + 4) * strength;
      exposed = Math.max(exposed, strength);
    }
    const distance = Math.hypot(dx, dy);
    if (distance > 45) { dx *= 45 / distance; dy *= 45 / distance; }
    const displacement = Math.hypot(dx, dy); maxDisplacement = Math.max(maxDisplacement, displacement);
    const ambient = 0;
    const bedX = (hash(g.id, 7) - .5) * 1100, bedY = 265 + hash(g.id, 8) * 34;
    return { id: g.id, protected: g.protected, homeX: g.x, homeY: g.y, x: bedX * (1 - assembled) + (g.x + dx + ambient) * assembled, y: bedY * (1 - assembled) + (g.y + dy + ambient * .5) * assembled, displacement, size: g.size, palette: g.palette, tone: g.tone, exposed };
  });
  const exposureAt = (x: number, y: number) => {
    let exposure = 0;
    for (const p of indexed.cells.get(`${Math.floor(x / indexed.cellSize)}:${Math.floor(y / indexed.cellSize)}`) ?? []) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < p.radius * 1.3) exposure = Math.max(exposure, (1 - ease(p.age / 4)) * (1 - ease(d / (p.radius * 1.3))));
    }
    return exposure;
  };
  const underpaint = Array.from({ length: 150 }, (_, i) => { const x = -525 + i * 1050 / 149, y = earlierShoreline(x); return { x, y, exposure: exposureAt(x, y) }; });
  const underpaintCells = UNDERPAINT_CELLS.map(p => ({ ...p, exposure: exposureAt(p.x, p.y) }));
  const drawnCount = data.fidelity === 'reduced' ? grains.filter(g=>g.protected||g.id%2===0).length : GRAIN_COUNT;
  return { seconds: t, filmSeconds: data.live ? 5 : t, zoom, panX, panY, assembled, grains, revealImpulses:[...new Set([...indexed.cells.values()].flat())], underpaint, underpaintCells, logicalCount: GRAIN_COUNT, drawnCount, maxDisplacement, activeImpulseCount: strokes.reduce((n,s) => n + s.points.filter(p => t >= p.at && t - p.at < 4).length,0), inputVersion: data.inputVersion, fidelity: data.fidelity, restored: maxDisplacement < 1e-9 };
}
export function observeShore(s: ShoreSnapshot) {
  const uniqueIds = new Set(s.grains.map(g=>g.id)).size;
  const maxDisplacement = Math.max(...s.grains.map(g=>s.assembled===1?Math.hypot(g.x-g.homeX,g.y-g.homeY):g.displacement));
  return { logicalCount: s.grains.length, uniqueIds, protectedCount:s.grains.filter(g=>g.protected).length, drawnCount: s.drawnCount,
    finite: s.grains.every(g => [g.x,g.y,g.homeX,g.homeY,g.size,g.displacement].every(Number.isFinite)),
    maxDisplacement, activeImpulseCount:s.activeImpulseCount,
    unexpiredImpulseIndex:s.revealImpulses.every(p=>p.age>=0&&p.age<4)&&s.revealImpulses.length===s.activeImpulseCount,
    exposedShoreSegments:s.underpaint.filter(p=>p.exposure>.25).length,
    exposedUnderpaintArea:s.underpaintCells.filter(p=>p.exposure>.25).reduce((area,p)=>area+p.width*p.height,0),
    restored:s.assembled===1&&maxDisplacement<1e-9, zoom:s.zoom,inputVersion:s.inputVersion,fidelity:s.fidelity,logicalSeconds:s.seconds };
}
