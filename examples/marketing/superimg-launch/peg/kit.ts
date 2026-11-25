// Geometry kit for the SuperImg character candidates.
//
// One neutral shape model feeds every output: standalone SVG assets, the HTML
// character sheet (static and live), and SuperImg typed vector nodes. A pose is
// plain numeric JSON, so any two poses of one character can be mixed.
//
// Coordinates: origin at the ground contact centre, +x right, +y down.

export type Pt = [number, number];
/** Affine matrix [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = [number, number, number, number, number, number];

export type Shape =
  | { k: "poly"; pts: Pt[]; round?: number | number[]; smooth?: boolean; open?: boolean }
  | { k: "circle"; c: Pt; r: number };

export type Item = {
  /** Stable part id, unique within one character build. */
  id: string;
  /** Palette key. An era maps roles to paint; geometry never names a colour. */
  role: string;
  shape: Shape;
  holes?: Shape[];
  opacity?: number;
  /** Stroke-only mark of this width (action lines, bands). */
  line?: number;
  dash?: string;
  /** Painted without a keyline or thickness (pressed-in details, decals, shadows). */
  flat?: boolean;
  /** Has no thickness of its own (cloth). The toy treatment gives it no under-lip. */
  thin?: boolean;
};

export const VIEW = { x: -130, y: -210, w: 260, h: 260 };

// ── numbers ────────────────────────────────────────────────────────────────

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const fmt = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? "0" : String(v);
};

export const ease = {
  linear: (t: number) => t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};
export type EaseName = keyof typeof ease;

/** Deep numeric mix of two same-shaped poses. Non-numbers come from `b` past the midpoint. */
export function mix<T>(a: T, b: T, t: number): T {
  if (typeof a === "number" && typeof b === "number") return lerp(a, b, t) as T;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i], t)) as T;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(a as object)) {
      out[key] = mix((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], t);
    }
    return out as T;
  }
  return t < 0.5 ? a : b;
}

/** Mix two #rrggbb colours. */
export function tint(from: string, to: string, amount: number): string {
  const part = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map(i => Math.round(lerp(part(from, i), part(to, i), amount)).toString(16).padStart(2, "0")).join("");
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic value in [-1, 1] for an integer lattice point. */
function lattice(i: number, seed: number): number {
  let h = Math.imul(i ^ seed, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth 1-D noise, periodic over `period` lattice cells. */
export function noise(x: number, seed: number, period: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = lattice(((i % period) + period) % period, seed);
  const b = lattice((((i + 1) % period) + period) % period, seed);
  return lerp(a, b, u);
}

// ── shapes ─────────────────────────────────────────────────────────────────

export const poly = (pts: Pt[], round?: number | number[]): Shape => ({ k: "poly", pts, round });
export const blob = (pts: Pt[]): Shape => ({ k: "poly", pts, smooth: true });
export const stroke = (pts: Pt[], smooth = false): Shape => ({ k: "poly", pts, open: true, smooth });
export const circle = (cx: number, cy: number, r: number): Shape => ({ k: "circle", c: [cx, cy], r });
export const rect = (x: number, y: number, w: number, h: number, round: number | number[] = 0): Shape =>
  poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], round);
export const capsule = (cx: number, cy: number, w: number, h: number): Shape =>
  rect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2);
export const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 20): Shape =>
  blob(Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  }));

// ── transforms ─────────────────────────────────────────────────────────────

export const I: Mat = [1, 0, 0, 1, 0, 0];
/** Compose so the first matrix listed is applied first. */
export function chain(...ms: Mat[]): Mat {
  return ms.reduce((m, n) => [
    n[0] * m[0] + n[2] * m[1],
    n[1] * m[0] + n[3] * m[1],
    n[0] * m[2] + n[2] * m[3],
    n[1] * m[2] + n[3] * m[3],
    n[0] * m[4] + n[2] * m[5] + n[4],
    n[1] * m[4] + n[3] * m[5] + n[5],
  ], I);
}
export const move = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export function turn(deg: number, cx = 0, cy = 0): Mat {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}
export const size = (sx: number, sy = sx, cx = 0, cy = 0): Mat => [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
/** Lean: shifts points sideways in proportion to their height above `cy`. */
export const lean = (deg: number, cy = 0): Mat => [1, 0, -Math.tan(rad(deg)), 1, Math.tan(rad(deg)) * cy, 0];
/** Vertical shear, for a sheet seen partly edge-on. */
export const shear = (deg: number, cx = 0): Mat => [1, Math.tan(rad(deg)), 0, 1, 0, -Math.tan(rad(deg)) * cx];

export const at = (m: Mat, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export function place(shape: Shape, m: Mat): Shape {
  const det = m[0] * m[3] - m[1] * m[2];
  const k = Math.sqrt(Math.abs(det));
  if (shape.k === "circle") {
    const even = Math.abs(Math.hypot(m[0], m[1]) - Math.hypot(m[2], m[3])) < 1e-3 && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-3;
    if (even) return { k: "circle", c: at(m, shape.c), r: shape.r * k };
    return place(ellipse(shape.c[0], shape.c[1], shape.r, shape.r, 24), m);
  }
  const round = Array.isArray(shape.round) ? shape.round.map(r => r * k) : shape.round === undefined ? undefined : shape.round * k;
  return { ...shape, pts: shape.pts.map(p => at(m, p)), round };
}

export function placeItem(item: Item, m: Mat): Item {
  const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  return {
    ...item,
    shape: place(item.shape, m),
    holes: item.holes?.map(h => place(h, m)),
    line: item.line === undefined ? undefined : item.line * k,
  };
}
export const placeAll = (items: Item[], m: Mat): Item[] => items.map(i => placeItem(i, m));

// ── paths ──────────────────────────────────────────────────────────────────

type Seg = { from: Pt; c1?: Pt; c2?: Pt; to: Pt };

function cornerRadius(shape: { round?: number | number[] }, i: number): number {
  if (Array.isArray(shape.round)) return shape.round[i] ?? 0;
  return shape.round ?? 0;
}

/** Curve segments for a shape. Rounded corners are quadratic, smooth shapes Catmull-Rom. */
function segments(shape: Shape): Seg[] {
  if (shape.k === "circle") return segments(ellipse(shape.c[0], shape.c[1], shape.r, shape.r, 16));
  const { pts, open } = shape;
  const n = pts.length;
  const segs: Seg[] = [];
  if (shape.smooth) {
    const get = (i: number): Pt => (open ? pts[clamp(i, 0, n - 1)] : pts[((i % n) + n) % n]);
    const last = open ? n - 1 : n;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      segs.push({
        from: p1,
        c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
        c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
        to: p2,
      });
    }
    return segs;
  }
  if (open) {
    for (let i = 0; i < n - 1; i++) segs.push({ from: pts[i], to: pts[i + 1] });
    return segs;
  }
  // Closed polygon with optional corner rounding.
  const cuts = pts.map((v, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const r = cornerRadius(shape, i);
    const la = Math.hypot(prev[0] - v[0], prev[1] - v[1]);
    const lb = Math.hypot(next[0] - v[0], next[1] - v[1]);
    if (r <= 0 || la === 0 || lb === 0) return { v, a: v, b: v, sharp: true };
    const cos = ((prev[0] - v[0]) * (next[0] - v[0]) + (prev[1] - v[1]) * (next[1] - v[1])) / (la * lb);
    const half = Math.acos(clamp(cos, -1, 1)) / 2;
    const d = Math.min(r / Math.max(Math.tan(half), 0.01), la / 2, lb / 2);
    return {
      v,
      a: [v[0] + ((prev[0] - v[0]) / la) * d, v[1] + ((prev[1] - v[1]) / la) * d] as Pt,
      b: [v[0] + ((next[0] - v[0]) / lb) * d, v[1] + ((next[1] - v[1]) / lb) * d] as Pt,
      sharp: false,
    };
  });
  for (let i = 0; i < n; i++) {
    const cut = cuts[i];
    const next = cuts[(i + 1) % n];
    if (!cut.sharp) segs.push({ from: cut.a, c1: cut.v, to: cut.b });
    segs.push({ from: cut.b, to: next.a });
  }
  return segs;
}

export function pathD(shape: Shape): string {
  const segs = segments(shape);
  if (!segs.length) return "";
  let d = `M${fmt(segs[0].from[0])} ${fmt(segs[0].from[1])}`;
  for (const s of segs) {
    if (s.c1 && s.c2) d += `C${fmt(s.c1[0])} ${fmt(s.c1[1])} ${fmt(s.c2[0])} ${fmt(s.c2[1])} ${fmt(s.to[0])} ${fmt(s.to[1])}`;
    else if (s.c1) d += `Q${fmt(s.c1[0])} ${fmt(s.c1[1])} ${fmt(s.to[0])} ${fmt(s.to[1])}`;
    else d += `L${fmt(s.to[0])} ${fmt(s.to[1])}`;
  }
  const open = shape.k === "poly" && shape.open;
  return open ? d : d + "Z";
}

/** Points along the outline, for hand-drawn wobble and pixel sampling. */
export function flatten(shape: Shape, steps = 6): Pt[] {
  if (shape.k === "circle") {
    return Array.from({ length: 28 }, (_, i): Pt => {
      const a = (i / 28) * Math.PI * 2;
      return [shape.c[0] + Math.cos(a) * shape.r, shape.c[1] + Math.sin(a) * shape.r];
    });
  }
  const out: Pt[] = [];
  const segs = segments(shape);
  segs.forEach((s, index) => {
    if (index === 0) out.push(s.from);
    if (!s.c1) {
      out.push(s.to);
      return;
    }
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      if (s.c2) {
        out.push([
          u * u * u * s.from[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.to[0],
          u * u * u * s.from[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.to[1],
        ]);
      } else {
        out.push([
          u * u * s.from[0] + 2 * u * t * s.c1[0] + t * t * s.to[0],
          u * u * s.from[1] + 2 * u * t * s.c1[1] + t * t * s.to[1],
        ]);
      }
    }
  });
  const open = shape.open;
  if (!open && out.length > 1) {
    const [a, b] = [out[0], out[out.length - 1]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) out.pop();
  }
  return out;
}

/** Evenly spaced points along a polyline. */
export function resample(pts: Pt[], spacing: number, closed: boolean): Pt[] {
  const ring = closed ? [...pts, pts[0]] : pts;
  let total = 0;
  for (let i = 1; i < ring.length; i++) total += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
  if (total === 0) return pts;
  const count = Math.max(closed ? 6 : 2, Math.round(total / spacing));
  const step = total / (closed ? count : count - 1);
  const out: Pt[] = [];
  let seg = 1;
  let walked = 0;
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (seg < ring.length - 1) {
      const len = Math.hypot(ring[seg][0] - ring[seg - 1][0], ring[seg][1] - ring[seg - 1][1]);
      if (walked + len >= target) break;
      walked += len;
      seg++;
    }
    const a = ring[seg - 1];
    const b = ring[seg];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = clamp((target - walked) / len);
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}

/** A hand-drawn version of a shape: resampled, nudged by smooth noise, re-smoothed. */
export function wobble(shape: Shape, seed: number, amount: number): Shape {
  const open = shape.k === "poly" && !!shape.open;
  const flat = flatten(shape);
  let length = 0;
  for (let i = 1; i < flat.length; i++) length += Math.hypot(flat[i][0] - flat[i - 1][0], flat[i][1] - flat[i - 1][1]);
  const spacing = clamp(length / 22, 2.2, 8);
  const pts = resample(flat, spacing, !open);
  const period = Math.max(3, Math.round(pts.length / 2.5));
  const scale = clamp(length / 120, 0.35, 1) * amount;
  const moved = pts.map((p, i): Pt => {
    const x = (i / pts.length) * period;
    return [p[0] + noise(x, seed, period) * scale, p[1] + noise(x, seed + 7919, period) * scale];
  });
  return { k: "poly", pts: moved, smooth: true, open };
}

export function inside(pts: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function nearLine(pts: Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return best;
}

export function bounds(items: Item[]): { x0: number; y0: number; x1: number; y1: number } {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const item of items) {
    for (const [x, y] of flatten(item.shape, 3)) {
      b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
    }
  }
  return b;
}

// ── shared marks ───────────────────────────────────────────────────────────

/** Soft contact shadow; shrinks and fades as the subject lifts. */
export function shadow(cx: number, width: number, lift: number): Item {
  const k = clamp(1 - lift / 160, 0.35, 1);
  return { id: "shadow", role: "shadow", shape: ellipse(cx, 5, (width / 2) * k, 6 * k), flat: true, opacity: 0.55 + 0.45 * k };
}

/** Short radiating ticks around a point, between two angles. */
export function ticks(id: string, cx: number, cy: number, from: number, to: number, count: number, r0: number, r1: number, weight: number, opacity: number): Item[] {
  if (opacity <= 0.02) return [];
  return Array.from({ length: count }, (_, i): Item => {
    const a = rad(count === 1 ? from : lerp(from, to, i / (count - 1)));
    return {
      id: `${id}-${i}`, role: "fx", line: weight, opacity,
      shape: stroke([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]),
    };
  });
}

// ── performance timeline ───────────────────────────────────────────────────

/** `since` is the growth level at which the performer has learned this beat. */
export type Beat<P> = { pose: P; move: number; hold: number; ease?: EaseName; since?: number };

/** The beats a performer knows at a growth level. */
export const known = <P>(beats: Beat<P>[], level: number): Beat<P>[] => beats.filter(b => (b.since ?? 1) <= level);

/** Pose at `seconds` for a looping list of beats. Pure: same time, same pose. */
export function perform<P>(beats: Beat<P>[], seconds: number): P {
  const total = beats.reduce((sum, b) => sum + b.move + b.hold, 0);
  let t = ((seconds % total) + total) % total;
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const from = beats[(i - 1 + beats.length) % beats.length].pose;
    if (t < beat.move) return mix(from, beat.pose, ease[beat.ease ?? "out"](t / beat.move));
    t -= beat.move;
    if (t < beat.hold) return beat.pose;
    t -= beat.hold;
  }
  return beats[beats.length - 1].pose;
}

export const loopSeconds = <P>(beats: Beat<P>[]) => beats.reduce((sum, b) => sum + b.move + b.hold, 0);
