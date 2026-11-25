// Shared film language for the recap scenes: one palette, one chrome, one
// picture generator. Every scene draws the same frame so the cuts read as a
// single film instead of three title cards.

import { Frame, Text, Fill, type MediaElement, googleFont } from "@foxworth/superimg";

export const FILM = "#0B302F";
export const CREAM = "#F4EAD8";
export const PINK = "#F08CA0";
export const SUN = "#E9C46A";
export const DISPLAY = "'Archivo Black', Impact, sans-serif";
export const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const RECAP_FONTS = [googleFont("Archivo Black"), googleFont("Inter:wght@400;500;600;700"), googleFont("IBM Plex Mono:wght@400;500;600")];

export const RECAP_CSS = [
  "* { margin: 0; padding: 0; box-sizing: border-box; }",
  "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; }",
];

export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>> 0) % 100000) / 100000;
  };
}

/** A generated "photo": flat shapes in the film palette, stable per seed. */
export function picture(seed: string, w: number, h: number): string {
  const r = rng(seed);
  const inks = [CREAM, PINK, SUN];
  const ground = inks[Math.floor(r() * inks.length)]!;
  const mark = inks.filter((c) => c !== ground)[Math.floor(r() * 2)] ?? PINK;
  const shapes: string[] = [];
  const kinds = Math.floor(3 + r() * 3);
  for (let i = 0; i < kinds; i++) {
    const k = r();
    const cx = r() * w;
    const cy = r() * h;
    const size = (0.18 + r() * 0.42) * Math.min(w, h);
    const ink = i % 2 === 0 ? mark : FILM;
    const op = (0.5 + r() * 0.5).toFixed(2);
    if (k < 0.34) {
      shapes.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${ink}" opacity="${op}" />`,
      );
    } else if (k < 0.68) {
      shapes.push(
        `<rect x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}" width="${size.toFixed(
          1,
        )}" height="${(size * (0.4 + r() * 0.9)).toFixed(1)}" fill="${ink}" opacity="${op}"
         transform="rotate(${(r() * 40 - 20).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" />`,
      );
    } else {
      shapes.push(
        `<path d="M ${(cx - size / 2).toFixed(1)} ${(cy + size / 2).toFixed(1)}
          A ${(size / 2).toFixed(1)} ${(size / 2).toFixed(1)} 0 0 1 ${(cx + size / 2).toFixed(1)} ${(cy + size / 2).toFixed(1)} Z"
          fill="${ink}" opacity="${op}" />`,
      );
    }
  }
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = ((i + 0.5) / 9) * h;
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="${FILM}" stroke-width="1.5" opacity="0.14" />`;
  }).join("");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
    <rect width="${w}" height="${h}" fill="${ground}" />
    ${shapes.join("")}
    ${lines}
  </svg>`;
}

export interface ChromeOpts {
  width: number;
  height: number;
  px: (n: number) => number;
  alpha: (color: string, a: number) => string;
  sceneNo: string;
  sceneLabel: string;
  reel: string;
  progress: number;
  reveal: number;
}

/** Ground + edge marks + slate. Drawn identically by every scene. */
export function chrome(o: ChromeOpts): MediaElement[] {
  const { width, height, px, alpha, sceneNo, sceneLabel, reel, progress, reveal } = o;
  const inset = px(38);
  const ticks: MediaElement[] = [];
  const tickCount = 14;
  for (let i = 0; i < tickCount; i++) {
    const on = i / tickCount < progress;
    ticks.push(
      Frame({
        x: inset,
        y: Math.round(px(120) + (i * (height - px(240))) / tickCount),
        width: px(on ? 22 : 12),
        height: px(3),
        fill: alpha(on ? PINK : CREAM, on ? 0.9 : 0.22),
        style: { opacity: reveal },
      }),
    );
  }
  return [
    Fill({ color: FILM }),
    Fill({
      gradient: {
        kind: "radial",
        at: "50% 42%",
        size: "110% 110%",
        stops: ["rgba(255,255,255,0.055)", "rgba(255,255,255,0.012)", "transparent"],
      },
    }),
    Fill({
      gradient: {
        kind: "linear",
        angle: "180deg",
        stops: ["rgba(0,0,0,0.3)", "transparent 22%", "transparent 74%", "rgba(0,0,0,0.42)"],
      },
    }),
    ...ticks,
    Frame(
      { x: inset + px(34), y: inset, width: Math.round(width * 0.4), height: px(22), style: { opacity: reveal } },
      Text(
        { variant: "label", size: px(17), weight: 600, letterSpacing: px(3.4), fontFamily: MONO, color: alpha(CREAM, 0.62) },
        reel,
      ),
    ),
    Frame(
      {
        x: width - inset - px(300),
        y: inset,
        width: px(300),
        height: px(22),
        style: { opacity: reveal },
      },
      Frame(
        { x: px(300) - px(184), y: 0, width: px(184), height: px(22) },
        Text(
          { variant: "label", size: px(17), weight: 600, letterSpacing: px(3.4), fontFamily: MONO, color: alpha(CREAM, 0.62) },
          `${sceneNo} ${sceneLabel}`,
        ),
      ),
    ),
    Frame({
      x: inset + px(34),
      y: height - inset - px(4),
      width: width - (inset + px(34)) * 2,
      height: px(3),
      fill: alpha(CREAM, 0.16),
      style: { opacity: reveal },
    }),
    Frame({
      x: inset + px(34),
      y: height - inset - px(4),
      width: width - (inset + px(34)) * 2,
      height: px(3),
      fill: PINK,
      style: {
        opacity: reveal,
        transformOrigin: "left center",
        transform: `scaleX(${Math.max(0, Math.min(1, progress)).toFixed(4)})`,
      },
    }),
  ];
}
