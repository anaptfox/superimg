/**
 * Cleft's mark is fixed geometry. The film changes framing and surface paint;
 * a grain never acquires another identity or crosses the negative-space cut.
 */
export const CLEFT_PATHS = Object.freeze([
  "M8 8H92V38H62V62H38V82H8Z",
  "M92 48H72V72H48V92H8V112H92Z",
] as const);
/** The unpainted cut, bounded by the same canonical slab edges. */
export const CLEFT_GAP_PATH = "M92 38H62V62H38V82H8V92H48V72H72V48H92Z";
export const CLEFT_CUT_EDGES = Object.freeze({
  awayFromKey: "M92 38H62V62H38V82H8",
  facingKey: "M92 48H72V72H48V92H8",
});

export const CLEFT_PALETTE = Object.freeze({
  mist: "#E7E9E4", hematite: "#2B2A2D", cut: "#4C5552", edge: "#C9D2CB",
});
export const CLEFT_GRAIN_COUNT = 8_192;
export const CLEFT_LOOP_FRAMES = 120;
export const CLEFT_SEED = "cleft-mineral-v1";
const TAU = Math.PI * 2;

export type CleftMaterial = "ink" | "mineral" | "graphite";
export type CleftFidelity = "full" | "reduced";
export type CleftKind = "hero" | "sting" | "loop" | "live" | "poster" | "icon";
export interface CleftInput {
  teaching: boolean;
  fidelity: CleftFidelity;
  inputVersion: number;
  live: boolean;
  material: CleftMaterial | "auto";
  /** Null lets Player drive the authored clock; a number freezes a host pose. */
  logicalSeconds: number | null;
}
export const INITIAL_CLEFT: Readonly<CleftInput> = Object.freeze({
  teaching: false, fidelity: "full", inputVersion: 0, live: true,
  material: "auto", logicalSeconds: null,
});

export interface CleftClock { kind: CleftKind; seconds: number; frame?: number }
export interface CleftGrain {
  readonly id: number;
  readonly slab: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly seed: number;
  readonly relief: number;
  readonly facetAngle: number;
  readonly facetNx: number;
  readonly facetNy: number;
  readonly facetNz: number;
  readonly depth: number;
  readonly protected: boolean;
  readonly reduced: boolean;
}
export interface CleftSnapshot {
  readonly kind: CleftKind;
  readonly seconds: number;
  readonly frame: number;
  readonly phase: number;
  readonly input: Readonly<CleftInput>;
  readonly grains: readonly CleftGrain[];
  readonly drawnGrains: readonly CleftGrain[];
  readonly reveal: Readonly<{ upper: number; lower: number; fill: number }>;
  readonly weights: Readonly<Record<CleftMaterial, number>>;
  readonly camera: Readonly<{ scale: number; focusX: number; focusY: number }>;
  readonly current: number;
  readonly titleOpacity: number;
  readonly caption: string;
}

const UPPER = [[8, 8], [92, 8], [92, 38], [62, 38], [62, 62], [38, 62], [38, 82], [8, 82]] as const;
const LOWER = [[92, 48], [72, 48], [72, 72], [48, 72], [48, 92], [8, 92], [8, 112], [92, 112]] as const;
export const CLEFT_POLYGONS = Object.freeze([UPPER, LOWER] as const);
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const smooth = (p: number) => {
  const t = clamp01(p);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const during = (seconds: number, start: number, end: number) => smooth((seconds - start) / (end - start));

function hash(index: number, salt = 0): number {
  let x = (index + 1 + salt * 10_003) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
}

export function insidePolygon(x: number, y: number, slab: 0 | 1): boolean {
  const points = CLEFT_POLYGONS[slab];
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function boundaryDistance(x: number, y: number, slab: 0 | 1): number {
  const points = CLEFT_POLYGONS[slab];
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp01(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy));
    nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return nearest;
}

/** Fixed low-discrepancy sampling avoids random draws or frame-history state. */
function createGrains(): readonly CleftGrain[] {
  const result: CleftGrain[] = [];
  let candidate = 0;
  let decorativeIndex = 0;
  while (result.length < CLEFT_GRAIN_COUNT) {
    const n = candidate++;
    const x = 8 + ((n * 0.7548776662466927 + 0.5) % 1) * 84;
    const y = 8 + ((n * 0.5698402909980532 + 0.5) % 1) * 104;
    const slab = insidePolygon(x, y, 0) ? 0 : insidePolygon(x, y, 1) ? 1 : undefined;
    if (slab === undefined) continue;
    const id = result.length;
    const protectedGrain = boundaryDistance(x, y, slab) < 0.85;
    const relief = 0.38 * Math.sin(x * 0.18) * Math.cos(y * 0.14) + hash(id, 9) * 0.62;
    const facetAngle = hash(id, 11) * TAU;
    const tilt = .13 + hash(id, 12) * .25;
    // Analytic relief slope plus one fixed facet tilt. Brightness follows the
    // orientation of this normal rather than an independent random value.
    const nx = -.38 * .18 * Math.cos(x * .18) * Math.cos(y * .14) + Math.cos(facetAngle) * tilt;
    const ny = .38 * .14 * Math.sin(x * .18) * Math.sin(y * .14) + Math.sin(facetAngle) * tilt;
    const normalLength = Math.hypot(nx, ny, 1);
    result.push(Object.freeze({
      id, slab, x, y, radius: 0.24 + hash(id, 3) * 0.35,
      seed: hash(id, 7), relief,
      facetAngle, facetNx: nx / normalLength, facetNy: ny / normalLength, facetNz: 1 / normalLength,
      depth: Math.min(3, Math.floor(clamp01((relief + 0.38) / 1.38) * 4)),
      protected: protectedGrain,
      reduced: protectedGrain || decorativeIndex++ % 2 === 0,
    }));
  }
  return Object.freeze(result);
}
export const CLEFT_GRAINS = createGrains();
const REDUCED_GRAINS = Object.freeze(CLEFT_GRAINS.filter(grain => grain.reduced));

/** Discrete encoded frames, not inclusive authored seconds, define the loop. */
export function cleftLoopPhase(frame: number): number {
  return ((Math.trunc(frame) % CLEFT_LOOP_FRAMES) + CLEFT_LOOP_FRAMES) % CLEFT_LOOP_FRAMES / CLEFT_LOOP_FRAMES;
}

function materialWeights(mineral: number, graphite: number): Readonly<Record<CleftMaterial, number>> {
  return Object.freeze({ ink: (1 - mineral) * (1 - graphite), mineral: mineral * (1 - graphite), graphite });
}

function teachingCaption(kind: CleftKind, seconds: number): string {
  if (kind === "hero") {
    if (seconds >= 4 && seconds < 6) return "Two slabs. One continuous cut.";
    if (seconds >= 7 && seconds < 10) return "Relief changes the light, not the contour.";
    if (seconds >= 12 && seconds < 15) return "One geometry carries three materials.";
    if (seconds >= 15) return "The cut remains the signature.";
  }
  if (kind === "sting" && seconds >= 2.5) return "Matter holds the mark.";
  return "";
}

/** Every film and live pose lowers from this same immutable model. */
export function sampleCleft(input: Readonly<CleftInput>, clock: CleftClock): CleftSnapshot {
  const seconds = Math.max(0, input.logicalSeconds ?? clock.seconds);
  const frame = clock.frame ?? Math.round(seconds * 30);
  const phase = clock.kind === "loop" ? cleftLoopPhase(frame) : (seconds / 4) % 1;
  let upper = 1, lower = 1, fill = 1;
  let mineral = 1, graphite = 0;
  let zoom = 0, focusX = 50, focusY = 60;
  let current = 0;
  let titleOpacity = 1;

  if (clock.kind === "hero") {
    upper = during(seconds, 2, 3.6);
    lower = during(seconds, 2.12, 3.72);
    fill = during(seconds, 3.05, 4);
    zoom = during(seconds, 6, 8) * (1 - during(seconds, 10, 12));
    focusX = mix(50, 59, zoom);
    focusY = mix(60, 64, zoom);
    mineral = 1 - during(seconds, 12, 12.6) + during(seconds, 12.9, 13.5);
    graphite = during(seconds, 13.9, 14.8);
    current = 0.4 * during(seconds, 6, 6.8) * (1 - during(seconds, 9.4, 10))
      + during(seconds, 12.9, 13.5) * (1 - during(seconds, 13.9, 14.8));
    titleOpacity = during(seconds, 3.2, 4) * (1 - during(seconds, 6, 6.6)) + during(seconds, 11.4, 12.1);
  } else if (clock.kind === "sting") {
    upper = during(seconds, 0.35, 1.38);
    lower = during(seconds, 0.47, 1.5);
    fill = during(seconds, 1.1, 1.5);
    mineral = during(seconds, 2.5, 3.1);
    current = during(seconds, 2.5, 3) * (1 - during(seconds, 4.4, 4.8));
    titleOpacity = during(seconds, 4.7, 5.2);
  } else if (clock.kind === "live") {
    upper = during(seconds, 0, 1.45);
    lower = during(seconds, 0.12, 1.57);
    fill = during(seconds, 1.1, 1.6);
    mineral = during(seconds, 4, 4.65);
    graphite = during(seconds, 5.6, 6.3);
    current = mineral * (1 - graphite);
    titleOpacity = during(seconds, 1.3, 1.7);
  } else if (clock.kind === "loop") {
    current = 0.72;
    titleOpacity = 0;
  } else if (clock.kind === "icon") {
    mineral = 0;
    titleOpacity = 0;
  }

  const automatic = materialWeights(mineral, graphite);
  const weights = input.material === "auto" ? automatic : Object.freeze({
    ink: input.material === "ink" ? 1 : 0,
    mineral: input.material === "mineral" ? 1 : 0,
    graphite: input.material === "graphite" ? 1 : 0,
  });
  return Object.freeze({
    kind: clock.kind, seconds, frame, phase, input: Object.freeze({ ...input }),
    grains: CLEFT_GRAINS,
    drawnGrains: input.fidelity === "reduced" ? REDUCED_GRAINS : CLEFT_GRAINS,
    reveal: Object.freeze({ upper, lower, fill }), weights,
    camera: Object.freeze({ scale: mix(1, 2.8, zoom), focusX, focusY }),
    current, titleOpacity: clamp01(titleOpacity),
    caption: input.teaching ? teachingCaption(clock.kind, seconds) : "",
  });
}

/** A directional, cyclic lighting current; geometry itself stays fixed. */
export function cleftGrainLight(grain: CleftGrain, snapshot: CleftSnapshot): number {
  // CSS stage light travels at 125 degrees: its source is upper-left. A small
  // periodic angular current keeps the loop alive without changing geometry.
  const azimuth = Math.PI * 125 / 180 + Math.sin(TAU * snapshot.phase - grain.y * .035 + grain.x * .018) * .09 * snapshot.current;
  const lx = -Math.sin(azimuth), ly = Math.cos(azimuth), lz = .42;
  const lightLength = Math.hypot(lx, ly, lz);
  const diffuse = Math.max(0, (grain.facetNx * lx + grain.facetNy * ly + grain.facetNz * lz) / lightLength);
  return clamp01(.24 + diffuse * .82);
}

export function observeCleft(snapshot: CleftSnapshot) {
  const finite = snapshot.grains.every(grain => [grain.x, grain.y, grain.radius, grain.relief, grain.facetNx, grain.facetNy, grain.facetNz].every(Number.isFinite));
  return {
    kind: snapshot.kind,
    inputVersion: snapshot.input.inputVersion,
    seed: CLEFT_SEED,
    fidelity: snapshot.input.fidelity,
    logicalPopulation: snapshot.grains.length,
    drawnPopulation: snapshot.drawnGrains.length,
    protectedPopulation: snapshot.grains.filter(grain => grain.protected).length,
    finite,
    gapClear: snapshot.grains.every(grain => insidePolygon(grain.x, grain.y, grain.slab)),
    contourIdentity: CLEFT_PATHS.join("|"),
    reveal: { ...snapshot.reveal },
    material: { ...snapshot.weights },
    camera: { ...snapshot.camera },
    loop: { frame: snapshot.frame, phase: snapshot.phase, framesPerCycle: CLEFT_LOOP_FRAMES },
    silhouette: { viewBoxWidth: 100, viewBoxHeight: 120, minimumGap: 10 },
    detail: { maximumFacetRadius: 0.59, authorReported: true },
  };
}

/** Timings are original score intentions; audio baking stays outside this module. */
export const CLEFT_SOUND_CUES = Object.freeze({
  hero: [
    { at: 2, kind: "stone-impact", duration: 1.8 },
    { at: 6, kind: "bowed-glass", duration: 4 },
    { at: 12.4, kind: "mineral-current", duration: 1.5 },
    { at: 15, kind: "stone-settle", duration: 2 },
  ],
  sting: [
    { at: 0.35, kind: "stone-impact", duration: 1.3 },
    { at: 2.5, kind: "bowed-glass", duration: 2.3 },
  ],
  loop: [{ at: 0, kind: "cyclic-bowed-glass", duration: 4 },{ at: 3.7, kind: "wrapped-stone", duration: 1.8 }],
});
