//! Shared world for the three-scene film.
//! One horizon, one sun, one sky that keeps changing. Each cut is a match cut:
//! the next scene picks the sun up exactly where the last one left it.

import { Fill, Frame, Text, type TextProps, googleFont } from "@foxworth/superimg";

export const FILM_FONTS = [googleFont("Instrument+Serif:wght@400"), googleFont("DM+Mono:wght@400;500")];
export const DISPLAY = "'Instrument Serif', Georgia, serif";
export const MONO = "'DM Mono', ui-monospace, monospace";

/** Every scene draws the horizon at the same height so the cut carries. */
export const HORIZON = 0.66;
const MARGIN = 0.11;
const STOP_POSITIONS = ["0%", "46%", "78%", "100%"];

export interface Geometry {
  horizonY: number;
  margin: number;
  s: number;
}

export function geometry(width: number, height: number): Geometry {
  return {
    horizonY: Math.round(height * HORIZON),
    margin: Math.round(width * MARGIN),
    s: Math.min(width, height) / 1080,
  };
}

export interface Sky {
  stops: [string, string, string, string];
  land: string;
  ink: string;
}

export const DAWN: Sky = {
  stops: ["#0D1020", "#241C3B", "#5E3B4C", "#9A5A4B"],
  land: "#080A12",
  ink: "#F6EEE4",
};

export const DAY: Sky = {
  stops: ["#C9D9E4", "#E6E7DD", "#F3EDDF", "#F7F1E3"],
  land: "#1D2A25",
  ink: "#141C1A",
};

export const DUSK: Sky = {
  stops: ["#16222B", "#4A3444", "#8C4638", "#D9713F"],
  land: "#070C10",
  ink: "#F6EEE4",
};

function channels(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function mixHex(from: string, to: string, p: number): string {
  const a = channels(from);
  const b = channels(to);
  const mixed = a.map((c, i) => Math.round(c + (b[i]! - c) * p));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Cross-fade two skies so a hard cut lands mid-change instead of mid-slide. */
export function mixSky(from: Sky, to: Sky, p: number): Sky {
  return {
    stops: from.stops.map((c, i) => mixHex(c, to.stops[i]!, p)) as Sky["stops"],
    land: mixHex(from.land, to.land, p),
    ink: mixHex(from.ink, to.ink, p),
  };
}

export function sky(paint: Sky) {
  return Fill({
    id: "sky",
    gradient: {
      kind: "linear",
      angle: "180deg",
      stops: paint.stops.map((c, i) => `${c} ${STOP_POSITIONS[i]}`),
    },
  });
}

export function ground(g: Geometry, width: number, height: number, paint: Sky) {
  return Frame(
    { id: "ground", x: 0, y: g.horizonY, width, height: height - g.horizonY },
    Fill({ color: paint.land }),
  );
}

/** The sun rides above the land and is clipped by the horizon as it sets. */
export function sun(
  g: Geometry,
  width: number,
  opts: { cx: number; cy: number; r: number; color: string },
) {
  const disc = Frame(
    {
      id: "sun",
      x: Math.round(opts.cx - opts.r),
      y: Math.round(opts.cy - opts.r),
      width: Math.round(opts.r * 2),
      height: Math.round(opts.r * 2),
      radius: 999,
    },
    Fill({ color: opts.color }),
  );
  return Frame({ x: 0, y: 0, width, height: g.horizonY, overflow: "hidden" }, disc);
}

export const SUN = "#F2A65A";

export interface SunState {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Four sun positions shared by all three scenes. Scene N ends on the same key
 * scene N+1 starts from, so the cuts read as one continuous afternoon.
 */
export function sunKey(
  g: Geometry,
  width: number,
  height: number,
  key: "under" | "low" | "high" | "set",
): SunState {
  switch (key) {
    case "under":
      return { cx: g.margin + 70 * g.s, cy: g.horizonY + 150 * g.s, r: 120 * g.s };
    case "low":
      return { cx: g.margin + 70 * g.s, cy: g.horizonY + 28 * g.s, r: 120 * g.s };
    case "high":
      return { cx: width * 0.74, cy: height * 0.21, r: 74 * g.s };
    case "set":
      return { cx: width * 0.78, cy: g.horizonY + 110 * g.s, r: 112 * g.s };
  }
}

export function lerpSun(from: SunState, to: SunState, p: number): SunState {
  return {
    cx: from.cx + (to.cx - from.cx) * p,
    cy: from.cy + (to.cy - from.cy) * p,
    r: from.r + (to.r - from.r) * p,
  };
}

export function horizon(
  g: Geometry,
  opts: { x: number; width: number; color: string; thickness?: number },
) {
  return Fill({
    id: "horizon",
    x: Math.round(opts.x),
    y: g.horizonY - 1,
    width: Math.max(2, Math.round(opts.width)),
    height: opts.thickness ?? 2,
    color: opts.color,
  });
}

/**
 * One record for the whole film. Every scene takes the same shape and reads
 * only the fields it needs, so compose() lays them end to end without
 * translating data at the cuts.
 */
export interface FilmData extends Record<string, unknown> {
  title: string;
  heading: string;
  body: string;
  cta: string;
  accentColor: string;
  brandName?: string;
}

export const FILM_SAMPLE: FilmData = {
  title: "First light",
  heading: "Three scenes, one clock",
  body: "Each scene keeps its own director. The film keeps one horizon.",
  cta: "Cut. Render. Ship.",
  accentColor: SUN,
  brandName: "SuperImg",
};

export function slug(g: Geometry, text: string, color: string, motion: TextProps["motion"]) {
  return Text(
    {
      id: "slug",
      variant: "label",
      size: Math.round(21 * g.s),
      weight: 500,
      letterSpacing: Math.round(4 * g.s),
      color,
      fontFamily: MONO,
      motion,
    },
    text,
  );
}
