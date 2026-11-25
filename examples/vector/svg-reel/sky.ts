import { h, vector, type MediaElement } from "@foxworth/superimg";

// Shared chart stock for the Winter Sky reel: one palette, one frame, one
// catalogue. Every chapter draws on the same plate so the reel reads as a film.

export const NIGHT = "#080C16";
export const NIGHT_LIT = "#141F38";
export const BONE = "#E8E2D0";
export const GOLD = "#F2C879";
export const ICE = "#BBD3F0";

export type Star = {
  id: string;
  name: string;
  bayer: string;
  /** Chart-space position, 0–1 within the plotting box. */
  x: number;
  y: number;
  /** Apparent magnitude — smaller is brighter. */
  mag: number;
  hue: "warm" | "cold";
  /** Hand-placed label direction, so names never sit on a line or each other. */
  lx: -1 | 0 | 1;
  ly: number;
};

export const ORION: readonly Star[] = [
  { id: "rigel", name: "Rigel", bayer: "β", x: 0.74, y: 0.86, mag: 0.13, hue: "cold", lx: 1, ly: 1.2 },
  { id: "betelgeuse", name: "Betelgeuse", bayer: "α", x: 0.29, y: 0.2, mag: 0.5, hue: "warm", lx: -1, ly: -0.7 },
  { id: "bellatrix", name: "Bellatrix", bayer: "γ", x: 0.72, y: 0.25, mag: 1.64, hue: "cold", lx: 1, ly: -0.7 },
  { id: "alnilam", name: "Alnilam", bayer: "ε", x: 0.5, y: 0.52, mag: 1.69, hue: "cold", lx: 0, ly: 2.1 },
  { id: "alnitak", name: "Alnitak", bayer: "ζ", x: 0.4, y: 0.55, mag: 1.77, hue: "cold", lx: -1, ly: 1.1 },
  { id: "saiph", name: "Saiph", bayer: "κ", x: 0.37, y: 0.88, mag: 2.09, hue: "cold", lx: -1, ly: 1.2 },
  { id: "mintaka", name: "Mintaka", bayer: "δ", x: 0.6, y: 0.49, mag: 2.23, hue: "cold", lx: 1, ly: -1 },
  { id: "meissa", name: "Meissa", bayer: "λ", x: 0.52, y: 0.06, mag: 3.39, hue: "warm", lx: 1, ly: -1.2 },
];

/** Asterism edges, ordered so a draw-on builds the figure torso-first. */
export const ASTERISM: readonly [string, string][] = [
  ["alnitak", "alnilam"],
  ["alnilam", "mintaka"],
  ["betelgeuse", "bellatrix"],
  ["betelgeuse", "alnitak"],
  ["bellatrix", "mintaka"],
  ["alnitak", "saiph"],
  ["mintaka", "rigel"],
  ["betelgeuse", "meissa"],
  ["bellatrix", "meissa"],
];

export type Box = { x: number; y: number; w: number; h: number };

/** The plotting box: a centred square so the figure never stretches. */
export function chartBox(width: number, height: number): Box {
  const h = height * 0.66;
  return { x: width / 2 - h / 2, y: height * 0.17, w: h, h };
}

export function place(star: Star, box: Box): { x: number; y: number } {
  return { x: box.x + star.x * box.w, y: box.y + star.y * box.h };
}

/** Magnitude → drawn radius. Brighter stars are bigger, as on a real chart. */
export function starRadius(mag: number, unit: number): number {
  return unit * (1.55 - Math.min(mag, 4) * 0.28);
}

export function starColor(hue: Star["hue"]): string {
  return hue === "warm" ? GOLD : ICE;
}

/** Deterministic background field. Same seed, same sky, every render. */
export function fieldStars(width: number, height: number, count: number, seed: number): MediaElement[] {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const out: MediaElement[] = [];
  for (let i = 0; i < count; i++) {
    const x = next() * width;
    const y = next() * height;
    const r = 0.5 + next() * 1.5;
    const op = 0.12 + next() * 0.4;
    out.push(vector.path({ id: `field-${i}`, d: circle(x, y, r), fill: BONE, opacity: op }));
  }
  return out;
}

/** Ground wash + field, shared by every chapter. */
export function ground(width: number, height: number, seed: number): MediaElement {
  return vector.group({ id: "sky-ground" },
    vector.path({ id: "sky-wash", d: `M0,0H${width}V${height}H0Z`, fill: "url(#sky)" }),
    ...fieldStars(width, height, 170, seed),
  );
}

export function circle(x: number, y: number, r: number): string {
  return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
}

/** Native SVG tags fill the small gap in the vector factory vocabulary:
 * gradients and filters remain tree nodes, with inspectable definition ids. */
export function skyDefs(): MediaElement {
  return vector.defs(
    h("radialGradient", { id: "sky", cx: "50%", cy: "40%", r: "78%" },
      h("stop", { offset: "0%", "stop-color": NIGHT_LIT }),
      h("stop", { offset: "100%", "stop-color": NIGHT }),
    ),
    h("filter", { id: "bloom", x: "-120%", y: "-120%", width: "340%", height: "340%" },
      h("feGaussianBlur", { stdDeviation: 7, result: "b" }),
      h("feMerge", {}, h("feMergeNode", { in: "b" }), h("feMergeNode", { in: "SourceGraphic" })),
    ),
  );
}

/**
 * Chart furniture: border, corner ticks, running heads. `ruleP` extends the
 * rules from the centre; `op` fades the whole apparatus.
 */
export function furniture(opts: {
  width: number;
  height: number;
  chapter: string;
  plate: string;
  ruleP: number;
  op: number;
}): MediaElement {
  const { width, height, chapter, plate, ruleP, op } = opts;
  const m = 64;
  const cx = width / 2;
  const half = ((width - m * 2) / 2) * ruleP;
  const tick = 26;
  const corner = (id: string, x: number, sx: number, y: number, sy: number) =>
    vector.path({ id, d: `M${x},${y}L${x + sx * tick},${y}M${x},${y}L${x},${y + sy * tick}`,
      fill: "none", stroke: BONE, strokeWidth: 1.5, opacity: 0.55 });
  return vector.group({ id: "chart-furniture", opacity: op },
    corner("corner-nw", m, 1, m, 1), corner("corner-ne", width - m, -1, m, 1),
    corner("corner-sw", m, 1, height - m, -1), corner("corner-se", width - m, -1, height - m, -1),
    half > 0 ? vector.path({ id: "header-rule", d: `M${cx - half},${m + 44}H${cx + half}`, fill: "none", stroke: BONE, strokeWidth: 1, opacity: 0.22 }) : null,
    vector.text({ id: "chapter", x: m + 22, y: m + 30, family: "Inter, sans-serif", size: 18, weight: 600, fill: BONE, letterSpacing: 7, opacity: 0.8 }, chapter),
    vector.text({ id: "plate", x: width - m - 22, y: m + 30, anchor: "end", family: "Inter, sans-serif", size: 18, weight: 600, fill: GOLD, letterSpacing: 7, opacity: 0.75 }, plate),
    vector.text({ id: "series", x: m + 22, y: height - m - 20, family: "Inter, sans-serif", size: 16, fill: BONE, letterSpacing: 6, opacity: 0.4 }, "THE WINTER SKY"),
  );
}
