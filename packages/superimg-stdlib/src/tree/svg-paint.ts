//! Shared paint decisions for SVG lowering and the browser classifier.

import { colord } from "colord";
import type { MediaElement, MediaStyleValue } from "./node-types.js";
import type { FillGradient } from "./primitives.js";

export interface GradientStop {
  color: string;
  offset: string;
}

export interface ParsedLinearGradient {
  kind: "linear";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
}

export interface ParsedRadialGradient {
  kind: "radial";
  cx: number;
  cy: number;
  r: number;
  stops: GradientStop[];
}

export type ParsedGradient = ParsedLinearGradient | ParsedRadialGradient;

export interface ParsedBorder {
  width: number;
  color: string;
}

export interface SvgMotion {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  blur: number;
  filter: string;
}

export interface ResolvedPaint {
  fill?: string;
  gradient?: ParsedGradient;
  gradientInvalid: boolean;
  radius?: number;
  radiusInvalid: boolean;
  border?: ParsedBorder;
  borderInvalid: boolean;
  opacity?: number;
  opacityInvalid: boolean;
  blendMode?: string;
  motion?: SvgMotion;
  clip: boolean;
  /** Unsupported CSS style keys, without the `style:` prefix. */
  unsupportedStyle: string[];
  rawStyle: boolean;
}

/** CSS/SVG blend modes natively supported by resvg (excludes `plus-lighter`). */
export const RESVG_BLEND_MODES = new Set([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

const MOTION_KEYS = new Set([
  "x", "y", "scale", "rotate", "blur", "opacity", "phase", "style", "transform",
  "filter", "enter", "exit", "visible",
]);

const DIRECTION_DEG: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to right top": 45,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom left": 225,
  "to left bottom": 225,
  "to top left": 315,
  "to left top": 315,
};

export function isPlainColor(value: string): boolean {
  const color = value.trim();
  if (!color || /gradient\s*\(|url\s*\(/i.test(color)) return false;
  return colord(color).isValid();
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10000) / 10000;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseBorder(value: string): ParsedBorder | undefined {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px\s+solid\s+(\S(?:.*\S)?)$/i);
  if (!match) return undefined;
  const width = Number(match[1]);
  const color = match[2]!;
  if (!Number.isFinite(width) || width < 0 || !isPlainColor(color)) return undefined;
  return { width, color };
}

function parseStop(stop: string): GradientStop | undefined {
  const match = stop.trim().match(/^(.*\S)\s+(-?\d+(?:\.\d+)?)%$/);
  if (!match) return undefined;
  const color = match[1]!.trim();
  if (!isPlainColor(color)) return undefined;
  return { color, offset: `${match[2]}%` };
}

function parseStops(stops: unknown): GradientStop[] | undefined {
  if (!Array.isArray(stops) || stops.length === 0) return undefined;
  const parsed: GradientStop[] = [];
  for (const stop of stops) {
    if (typeof stop !== "string") return undefined;
    const next = parseStop(stop);
    if (!next) return undefined;
    parsed.push(next);
  }
  return parsed;
}

function parseDegrees(value: string): number | undefined {
  const match = value.trim().toLowerCase().match(/^(-?\d+(?:\.\d+)?)deg$/);
  if (!match) return undefined;
  return Number(match[1]);
}

function parseLinearAngle(at: unknown, angle: unknown): number | undefined {
  if (typeof at === "string" && at.trim()) {
    const key = at.trim().toLowerCase().replace(/\s+/g, " ");
    if (key in DIRECTION_DEG) return DIRECTION_DEG[key]!;
    return parseDegrees(key);
  }
  if (typeof angle === "number" && Number.isFinite(angle)) return angle;
  if (typeof angle === "string") return parseDegrees(angle);
  return 180;
}

/** CSS linear-gradient angle → objectBoundingBox line. 0deg points up. */
export function linearEndpoints(deg: number): Pick<ParsedLinearGradient, "x1" | "y1" | "x2" | "y2"> {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(dx) + Math.abs(dy);
  const hx = (dx * length) / 2;
  const hy = (dy * length) / 2;
  return { x1: 0.5 - hx, y1: 0.5 - hy, x2: 0.5 + hx, y2: 0.5 + hy };
}

function parseRadialCenter(at: unknown): { cx: number; cy: number } | undefined {
  if (at === undefined || at === "") return { cx: 0.5, cy: 0.5 };
  if (typeof at !== "string") return undefined;
  const key = at.trim().toLowerCase();
  if (key === "" || key === "center") return { cx: 0.5, cy: 0.5 };
  const match = key.match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!match) return undefined;
  return { cx: Number(match[1]) / 100, cy: Number(match[2]) / 100 };
}

function farthestCorner(cx: number, cy: number): number {
  let radius = 0;
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    radius = Math.max(radius, Math.hypot(cx - x, cy - y));
  }
  return radius;
}

export function parseGradient(gradient: FillGradient | unknown): ParsedGradient | undefined {
  if (!gradient || typeof gradient !== "object" || Array.isArray(gradient)) return undefined;
  const g = gradient as FillGradient;
  const stops = parseStops(g.stops);
  if (!stops) return undefined;
  if (g.kind === "linear") {
    const deg = parseLinearAngle(g.at, g.angle);
    if (deg === undefined) return undefined;
    return { kind: "linear", ...linearEndpoints(deg), stops };
  }
  if (g.kind === "radial") {
    if (g.size !== undefined) return undefined;
    const center = parseRadialCenter(g.at);
    if (!center) return undefined;
    return { kind: "radial", ...center, r: farthestCorner(center.cx, center.cy), stops };
  }
  return undefined;
}

function readFilter(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readMotion(value: unknown): SvgMotion | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const m = value as Record<string, unknown>;
  if (!isMotionLike(m)) return undefined;
  return {
    x: finite(m.x) ?? 0,
    y: finite(m.y) ?? 0,
    scale: finite(m.scale) ?? 1,
    rotate: finite(m.rotate) ?? 0,
    opacity: finite(m.opacity) ?? 1,
    blur: finite(m.blur) ?? 0,
    filter: readFilter(m.filter),
  };
}

function isMotionLike(m: Record<string, unknown>): boolean {
  if (typeof m.phase === "string" && typeof m.opacity === "number") return true;
  if (typeof m.transform === "string" && typeof m.opacity === "number") return true;
  if (
    typeof m.style === "string" &&
    typeof m.opacity === "number" &&
    (typeof m.x === "number" || typeof m.y === "number" || typeof m.scale === "number" || typeof m.rotate === "number")
  ) {
    return true;
  }
  const keys = Object.keys(m).filter((key) => m[key] !== undefined);
  return keys.length > 0
    && keys.every((key) => MOTION_KEYS.has(key))
    && keys.some((key) =>
      (key === "x" || key === "y" || key === "scale" || key === "rotate" || key === "blur")
      && typeof m[key] === "number"
    );
}

function parseOpacity(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const percent = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (percent) return Number(percent[1]) / 100;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

interface StyleScan {
  opacity?: number;
  opacityInvalid: boolean;
  blendMode?: string;
  border?: ParsedBorder;
  borderInvalid: boolean;
  borderRadius?: number;
  borderRadiusInvalid: boolean;
  motion?: SvgMotion;
  unsupportedStyle: string[];
  rawStyle: boolean;
}

function emptyScan(): StyleScan {
  return {
    opacityInvalid: false,
    borderInvalid: false,
    borderRadiusInvalid: false,
    unsupportedStyle: [],
    rawStyle: false,
  };
}

function parseBlendMode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return RESVG_BLEND_MODES.has(normalized) ? normalized : undefined;
}

function absorbStyleDeclaration(scan: StyleScan, key: string, value: unknown): boolean {
  if (key === "opacity") {
    const opacity = parseOpacity(value);
    if (opacity === undefined) scan.opacityInvalid = true;
    else scan.opacity = opacity;
    return true;
  }
  if (key === "mixBlendMode" || key === "mix-blend-mode") {
    const blendMode = parseBlendMode(value);
    if (blendMode === undefined) {
      scan.unsupportedStyle.push(key);
    } else {
      scan.blendMode = blendMode;
    }
    return true;
  }
  if (key === "border") {
    if (typeof value !== "string") scan.borderInvalid = true;
    else {
      const border = parseBorder(value);
      if (!border) scan.borderInvalid = true;
      else scan.border = border;
    }
    return true;
  }
  if (key === "borderRadius" || key === "border-radius") {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) scan.borderRadius = value;
    else scan.borderRadiusInvalid = true;
    return true;
  }
  return false;
}

function absorbStyleString(scan: StyleScan, raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const parts = trimmed.split(";").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return;
  const parsed: Array<[string, string]> = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon <= 0) {
      scan.rawStyle = true;
      return;
    }
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim();
    if (!val || (prop !== "mix-blend-mode" && prop !== "opacity")) {
      scan.rawStyle = true;
      return;
    }
    parsed.push([prop, val]);
  }
  for (const [prop, val] of parsed) {
    absorbStyleDeclaration(scan, prop, val);
  }
}

function absorbStyle(scan: StyleScan, style: MediaStyleValue | unknown): void {
  if (style == null || style === false || style === true) return;
  if (Array.isArray(style)) {
    for (const part of style) absorbStyle(scan, part);
    return;
  }
  const motion = readMotion(style);
  if (motion) {
    scan.motion = motion;
    return;
  }
  if (typeof style === "string") {
    absorbStyleString(scan, style);
    return;
  }
  if (typeof style !== "object") return;
  for (const [key, value] of Object.entries(style as Record<string, unknown>)) {
    if (value == null || value === false) continue;
    if (absorbStyleDeclaration(scan, key, value)) continue;
    scan.unsupportedStyle.push(key);
  }
}

export function resolvePaint(el: MediaElement): ResolvedPaint {
  const scan = emptyScan();
  absorbStyle(scan, el.props.style);
  if (scan.motion && scan.opacity !== undefined) {
    scan.motion.opacity *= scan.opacity;
    scan.opacity = undefined;
  }
  const propMotion = readMotion(el.props.motion);
  const motion = propMotion ?? scan.motion;
  if (propMotion && scan.motion) {
    motion!.opacity = propMotion.opacity * scan.motion.opacity;
  } else if (propMotion && scan.opacity !== undefined) {
    motion!.opacity = propMotion.opacity * scan.opacity;
    scan.opacity = undefined;
  }

  let gradient: ParsedGradient | undefined;
  let gradientInvalid = false;
  const gradientProp = el.props.gradient;
  if (gradientProp !== undefined) {
    gradient = parseGradient(gradientProp);
    gradientInvalid = gradient === undefined;
  }

  let fill: string | undefined;
  const fillProp = typeof el.props.fill === "string" ? el.props.fill
    : typeof el.props.color === "string" && el.type === "Fill" ? el.props.color
    : undefined;
  if (!gradient && typeof fillProp === "string") {
    if (isPlainColor(fillProp)) fill = fillProp;
    else if (fillProp.trim()) gradientInvalid = true;
  }

  let radius = scan.borderRadius;
  let radiusInvalid = scan.borderRadiusInvalid;
  if (radius === undefined && !radiusInvalid) {
    if (typeof el.props.radius === "number" && Number.isFinite(el.props.radius)) radius = el.props.radius;
    else if (typeof el.props.radius === "string" && el.props.radius.trim()) radiusInvalid = true;
  }

  let border = scan.border;
  let borderInvalid = scan.borderInvalid;
  if (!border && !borderInvalid && typeof el.props.border === "string") {
    const parsed = parseBorder(el.props.border);
    if (parsed) border = parsed;
    else if (el.props.border.trim()) borderInvalid = true;
  }

  let opacity = scan.opacity;
  if (motion && scan.opacity !== undefined && motion === propMotion) {
    opacity = undefined;
  }

  return {
    ...(fill !== undefined ? { fill } : {}),
    ...(gradient !== undefined ? { gradient } : {}),
    gradientInvalid,
    ...(radius !== undefined ? { radius } : {}),
    radiusInvalid,
    ...(border !== undefined ? { border } : {}),
    borderInvalid,
    ...(opacity !== undefined ? { opacity } : {}),
    opacityInvalid: scan.opacityInvalid,
    ...(scan.blendMode !== undefined ? { blendMode: scan.blendMode } : {}),
    ...(motion !== undefined ? { motion } : {}),
    clip: el.props.overflow === "hidden",
    unsupportedStyle: scan.unsupportedStyle,
    rawStyle: scan.rawStyle,
  };
}

export function hasPresentFilter(filter: string): boolean {
  return filter.length > 0 && filter.toLowerCase() !== "none";
}

export function motionHasBlur(motion: SvgMotion | undefined): boolean {
  return motion !== undefined && Math.abs(motion.blur) > 1e-4;
}
