//! Motion result CSS assembly + mergeMotion.

import type { MotionResult, MotionValue } from "./types.js";

function approxZero(v: number): boolean {
  return Math.abs(v) < 1e-4;
}

export function buildTransform(
  x: number,
  y: number,
  scale: number,
  rotate: number,
): string {
  const parts: string[] = [];
  if (!approxZero(x)) parts.push(`translateX(${x}px)`);
  if (!approxZero(y)) parts.push(`translateY(${y}px)`);
  if (!approxZero(scale - 1)) parts.push(`scale(${scale})`);
  if (!approxZero(rotate)) parts.push(`rotate(${rotate}deg)`);
  return parts.join(" ");
}

export function buildFilter(blur: number): string {
  return !approxZero(blur) ? `blur(${blur}px)` : "";
}

export function buildStyle(opacity: number, transform: string, filter: string): string {
  const parts = [`opacity:${opacity}`];
  if (transform) parts.push(`transform:${transform}`);
  if (filter) parts.push(`filter:${filter}`);
  return parts.join(";");
}

export function makeResult(
  x: number,
  y: number,
  scale: number,
  rotate: number,
  blur: number,
  opacity: number,
  enter: number,
  exitEased: number,
): MotionResult {
  let phase: MotionResult["phase"];
  if (enter <= 0) phase = "before";
  else if (exitEased >= 1) phase = "after";
  else if (exitEased > 0) phase = "exiting";
  else if (enter < 1) phase = "entering";
  else phase = "steady";
  const transform = buildTransform(x, y, scale, rotate);
  const filter = buildFilter(blur);
  return {
    x,
    y,
    scale,
    rotate,
    blur,
    opacity,
    enter,
    exit: exitEased,
    visible: enter > 0 && exitEased < 1,
    phase,
    transform,
    filter,
    style: buildStyle(opacity, transform, filter),
  };
}

/**
 * Merge multiple motion values into a single MotionResult.
 * Last-wins per property; transforms combine into one CSS string.
 *
 * @example
 * const card = t.motion({ y: 20 });
 * const idle = { scale: std.oscillate(time, { period: "1s", from: 0.98, to: 1.02 }) };
 * return `<div style="${std.css(std.mergeMotion(card, idle))}">`;
 */
export function mergeMotion(...motions: Array<MotionValue | MotionResult>): MotionResult {
  let x = 0,
    y = 0,
    scale = 1,
    rotate = 0,
    blur = 0,
    opacity = 1;
  let enter = 1,
    exitVal = 0;
  let visible = true;
  let phase: MotionResult["phase"] = "steady";

  for (const m of motions) {
    if (m.x !== undefined) x = m.x;
    if (m.y !== undefined) y = m.y;
    if (m.scale !== undefined) scale = m.scale;
    if (m.rotate !== undefined) rotate = m.rotate;
    if (m.blur !== undefined) blur = m.blur;
    if (m.opacity !== undefined) opacity = m.opacity;
    const r = m as MotionResult;
    if (r.enter !== undefined) enter = r.enter;
    if (r.exit !== undefined) exitVal = r.exit;
    if (r.visible !== undefined) visible = r.visible;
    if (r.phase !== undefined) phase = r.phase;
  }

  const transform = buildTransform(x, y, scale, rotate);
  const filter = buildFilter(blur);
  return {
    x,
    y,
    scale,
    rotate,
    blur,
    opacity,
    enter,
    exit: exitVal,
    visible,
    phase,
    transform,
    filter,
    style: buildStyle(opacity, transform, filter),
  };
}
