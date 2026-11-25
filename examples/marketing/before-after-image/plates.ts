// Generated stand-in photographs for the before/after compare.
// Same coastline, two grades — no network, no binary assets.

export type Grade = "flat" | "graded";

interface Palette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  ridges: readonly [string, string, string, string];
  water: string;
  streak: string;
  bird: string;
  veil: string;
  scanlines: boolean;
}

const PALETTES: Record<Grade, Palette> = {
  flat: {
    skyTop: "#A4B3AE",
    skyBottom: "#CBCEC4",
    sun: "#E9E3D2",
    sunGlow: "rgba(233,227,210,0.35)",
    ridges: ["#87938E", "#75817C", "#65706C", "#57615D"],
    water: "#93A09B",
    streak: "rgba(255,255,255,0.16)",
    bird: "#5D6763",
    veil: "rgba(168,198,196,0.20)",
    scanlines: true,
  },
  graded: {
    skyTop: "#22264F",
    skyBottom: "#E0764A",
    sun: "#FFD79A",
    sunGlow: "rgba(255,183,110,0.55)",
    ridges: ["#4A3550", "#33253D", "#221A2C", "#15111E"],
    water: "#3A2A3C",
    streak: "rgba(255,196,140,0.30)",
    bird: "#120E18",
    veil: "rgba(24,14,30,0.18)",
    scanlines: false,
  },
};

const W = 1200;
const H = 800;

const RIDGE_PATHS = [
  "M0,470 C140,430 250,452 360,432 C480,410 560,446 690,436 C820,426 950,398 1080,414 C1140,421 1180,430 1200,436 L1200,800 L0,800 Z",
  "M0,530 C120,506 230,538 350,520 C470,502 590,536 700,522 C840,504 950,530 1080,514 C1140,506 1180,512 1200,516 L1200,800 L0,800 Z",
  "M0,596 C160,574 260,606 400,592 C540,578 640,608 780,596 C900,586 1020,604 1200,590 L1200,800 L0,800 Z",
  "M0,672 C180,656 320,684 500,672 C680,660 820,686 1000,674 C1090,668 1160,672 1200,674 L1200,800 L0,800 Z",
];

const BIRDS: ReadonlyArray<readonly [number, number, number]> = [
  [268, 214, 1.15],
  [316, 190, 0.85],
  [352, 226, 0.7],
  [905, 172, 0.95],
  [948, 200, 0.72],
];

function bird(x: number, y: number, s: number, color: string): string {
  const a = 13 * s;
  const b = 6 * s;
  return `<path d="M${x - a},${y} q${a / 2},${-b} ${a},0 q${a / 2},${-b} ${a},0" fill="none" stroke="${color}" stroke-width="${(2.1 * s).toFixed(2)}" stroke-linecap="round"/>`;
}

/** A coastline plate as an inline SVG data URI. */
export function plate(grade: Grade): string {
  const p = PALETTES[grade];
  const ridges = RIDGE_PATHS.map(
    (d, i) => `<path d="${d}" fill="${p.ridges[i]}"/>`,
  ).join("");
  const birds = BIRDS.map(([x, y, s]) => bird(x, y, s, p.bird)).join("");
  const streaks = Array.from({ length: 9 }, (_, i) => {
    const y = 706 + i * 10;
    const inset = 40 + i * 46;
    return `<rect x="${inset}" y="${y}" width="${W - inset * 2}" height="2" fill="${p.streak}"/>`;
  }).join("");
  const scan = p.scanlines
    ? `<rect width="${W}" height="${H}" fill="url(#scan)"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.skyTop}"/>
      <stop offset="1" stop-color="${p.skyBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${p.sunGlow}"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="rgba(255,255,255,0.05)"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="742" cy="392" r="230" fill="url(#glow)"/>
  <circle cx="742" cy="392" r="72" fill="${p.sun}"/>
  ${ridges}
  <rect x="0" y="690" width="${W}" height="110" fill="${p.water}"/>
  ${streaks}
  ${birds}
  <rect width="${W}" height="${H}" fill="${p.veil}"/>
  ${scan}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
