//! Sketchy SVG via roughjs generator — pure strings, no DOM, no RAF.
//! Always seed (non-zero). Do not use fillStyle "dots" (non-deterministic).

import rough from "roughjs";
import type { Options as RoughJsOptions } from "roughjs/bin/core";

export type RoughFillStyle =
  | "hachure"
  | "solid"
  | "zigzag"
  | "cross-hatch"
  | "dashed"
  | "zigzag-line";

export interface RoughOpts {
  /** Non-zero seed for deterministic capture. Default 1. `0` is remapped to 1. */
  seed?: number;
  roughness?: number;
  bowing?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillStyle?: RoughFillStyle;
  hachureAngle?: number;
  hachureGap?: number;
  fillWeight?: number;
  preserveVertices?: boolean;
  disableMultiStroke?: boolean;
  fixedDecimalPlaceDigits?: number;
}

const gen = rough.generator();

function resolveSeed(seed: number | undefined): number {
  if (seed === undefined || seed === 0 || !Number.isFinite(seed)) return 1;
  return Math.floor(Math.abs(seed)) || 1;
}

function resolveOpts(opts: RoughOpts = {}): RoughJsOptions {
  if (opts.fillStyle === "dots") {
    throw new Error(
      'std.svg.rough: fillStyle "dots" is not seed-deterministic — use hachure, solid, zigzag, or cross-hatch',
    );
  }
  return {
    seed: resolveSeed(opts.seed),
    roughness: opts.roughness ?? 1,
    bowing: opts.bowing ?? 1,
    stroke: opts.stroke ?? "#e2e8f0",
    strokeWidth: opts.strokeWidth ?? 1.5,
    fill: opts.fill,
    fillStyle: opts.fillStyle ?? (opts.fill ? "hachure" : undefined),
    hachureAngle: opts.hachureAngle,
    hachureGap: opts.hachureGap,
    fillWeight: opts.fillWeight,
    preserveVertices: opts.preserveVertices ?? true,
    disableMultiStroke: opts.disableMultiStroke,
    fixedDecimalPlaceDigits: opts.fixedDecimalPlaceDigits ?? 2,
  };
}

function pathsToHtml(
  drawable: ReturnType<typeof gen.rectangle>,
  fixedDigits: number,
): string {
  const paths = gen.toPaths(drawable);
  return paths
    .map((p) => {
      const fill = p.fill && p.fill !== "none" ? ` fill="${p.fill}"` : ` fill="none"`;
      const stroke = p.stroke && p.stroke !== "none" ? ` stroke="${p.stroke}"` : ` stroke="none"`;
      const sw = p.strokeWidth != null ? ` stroke-width="${p.strokeWidth}"` : "";
      // toPaths already applies fixed decimals via options when set on drawable
      void fixedDigits;
      return `<path d="${p.d}"${stroke}${sw}${fill} stroke-linejoin="round"/>`;
    })
    .join("");
}

/** Roughen an SVG path `d` string into one or more sketchy `<path>` elements. */
export function path(d: string, opts: RoughOpts = {}): string {
  const o = resolveOpts(opts);
  const drawable = gen.path(d, o);
  return pathsToHtml(drawable, o.fixedDecimalPlaceDigits ?? 2);
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: RoughOpts = {},
): string {
  const o = resolveOpts(opts);
  return pathsToHtml(gen.rectangle(x, y, w, h, o), o.fixedDecimalPlaceDigits ?? 2);
}

export function circle(cx: number, cy: number, r: number, opts: RoughOpts = {}): string {
  const o = resolveOpts(opts);
  return pathsToHtml(gen.circle(cx, cy, r * 2, o), o.fixedDecimalPlaceDigits ?? 2);
}

export function ellipse(
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: RoughOpts = {},
): string {
  const o = resolveOpts(opts);
  return pathsToHtml(gen.ellipse(cx, cy, width, height, o), o.fixedDecimalPlaceDigits ?? 2);
}

export function polygon(points: Array<[number, number]>, opts: RoughOpts = {}): string {
  const o = resolveOpts(opts);
  return pathsToHtml(gen.polygon(points, o), o.fixedDecimalPlaceDigits ?? 2);
}

export function linearPath(points: Array<[number, number]>, opts: RoughOpts = {}): string {
  const o = resolveOpts({ ...opts, fill: opts.fill ?? undefined });
  // stroke-only by default for open paths
  const resolved = { ...o, fill: opts.fill ?? "none" };
  return pathsToHtml(gen.linearPath(points, resolved), resolved.fixedDecimalPlaceDigits ?? 2);
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: RoughOpts = {},
): string {
  const o = resolveOpts(opts);
  return pathsToHtml(gen.line(x1, y1, x2, y2, o), o.fixedDecimalPlaceDigits ?? 2);
}
