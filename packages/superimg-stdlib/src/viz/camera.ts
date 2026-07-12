/**
 * Stage camera — pure pan/zoom for explainer focus (Manim MovingCamera analogue).
 * Apply `style` / `transform` on an SVG or HTML wrapper around content.
 */

import { clamp01 } from "../easing.js";
import type { CoordSystem } from "./coords.js";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraState {
  /** Center x in the same space as rects (pixel or stage units) */
  x: number;
  y: number;
  /** Scale factor (1 = identity) */
  scale: number;
  /** CSS transform string (translate + scale) */
  transform: string;
  /** Full style attribute value for a stage wrapper */
  style: string;
}

export interface CameraOpts {
  /** Zoom level (1 = no zoom). Default 1. */
  zoom?: number;
  /** Pan target as [mathX, mathY] when using coords, else stage pixels. */
  pan?: [number, number];
  /** Stage width (for transform-origin). Defaults to coords.width when provided. */
  width?: number;
  height?: number;
}

function buildState(
  cx: number,
  cy: number,
  scale: number,
  stageW: number,
  stageH: number,
): CameraState {
  const s = Math.max(0.01, scale);
  // Keep focus point under stage center
  const tx = stageW / 2 - cx * s;
  const ty = stageH / 2 - cy * s;
  const transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s})`;
  const style = `transform:${transform};transform-origin:0 0;`;
  return { x: cx, y: cy, scale: s, transform, style };
}

/**
 * Explicit pan/zoom camera.
 * With `coords`, pan is in math space; without, pan is stage pixels.
 */
export function panZoom(
  opts: CameraOpts & { coords?: CoordSystem } = {},
): CameraState {
  const zoom = opts.zoom ?? 1;
  const pan = opts.pan ?? [0, 0];
  const coords = opts.coords;
  const stageW = opts.width ?? coords?.width ?? 1920;
  const stageH = opts.height ?? coords?.height ?? 1080;

  let cx: number;
  let cy: number;
  if (coords) {
    const p = coords.toPixel(pan[0], pan[1]);
    cx = p.px;
    cy = p.py;
  } else {
    cx = pan[0];
    cy = pan[1];
  }
  return buildState(cx, cy, zoom, stageW, stageH);
}

export interface AutoZoomOpts {
  /** Target rectangles in stage/pixel space */
  rects: readonly Rect[];
  /** Stage size */
  width: number;
  height: number;
  /** Margin fraction of the union box (default 0.12) */
  margin?: number;
  /**
   * Progress 0–1: 0 = full stage view, 1 = tight auto-zoom.
   * Omit or 1 for immediate zoom.
   */
  progress?: number;
  /** Max scale clamp (default 4) */
  maxScale?: number;
  /** Min scale clamp (default 0.25) */
  minScale?: number;
}

function unionRect(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Auto-zoom to fit target rects (Manim `MovingCamera.auto_zoom` analogue).
 * Progress blends from identity (full frame) to fitted zoom.
 */
export function autoZoom(opts: AutoZoomOpts): CameraState {
  const { width, height } = opts;
  const margin = opts.margin ?? 0.12;
  const p = clamp01(opts.progress ?? 1);
  const maxS = opts.maxScale ?? 4;
  const minS = opts.minScale ?? 0.25;

  const identity = buildState(width / 2, height / 2, 1, width, height);
  const box = unionRect(opts.rects);
  if (!box || box.width < 1e-6 || box.height < 1e-6) return identity;

  const mx = box.width * margin;
  const my = box.height * margin;
  const bw = box.width + 2 * mx;
  const bh = box.height + 2 * my;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  let scale = Math.min(width / bw, height / bh);
  scale = Math.max(minS, Math.min(maxS, scale));

  const target = buildState(cx, cy, scale, width, height);
  if (p >= 1) return target;
  if (p <= 0) return identity;

  // Lerp center and scale
  const x = identity.x + (target.x - identity.x) * p;
  const y = identity.y + (target.y - identity.y) * p;
  const s = identity.scale + (target.scale - identity.scale) * p;
  return buildState(x, y, s, width, height);
}

/**
 * Interpolate between two camera states (for director-driven moves).
 */
export function lerp(
  a: CameraState,
  b: CameraState,
  t: number,
  stageW: number,
  stageH: number,
): CameraState {
  const p = clamp01(t);
  return buildState(
    a.x + (b.x - a.x) * p,
    a.y + (b.y - a.y) * p,
    a.scale + (b.scale - a.scale) * p,
    stageW,
    stageH,
  );
}
