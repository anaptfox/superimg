/**
 * Indication overlays — Manim Indicate / Circumscribe / Flash / Wiggle analogues.
 * Pure: progress 0–1 drives a CSS/SVG flash over a pixel-space box.
 */

import { clamp01 } from "../easing.js";

export interface IndicateBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function easePulse(p: number): number {
  // 0 → 1 → 0 over full progress
  const t = clamp01(p);
  return Math.sin(t * Math.PI);
}

/**
 * Expanding/fading ring around a box (Circumscribe-ish).
 */
export function circle(box: IndicateBox, progress: number, opts?: {
  color?: string;
  strokeWidth?: number;
}): string {
  const pulse = easePulse(progress);
  if (pulse <= 0.001) return "";
  const color = opts?.color ?? "#fbbf24";
  const sw = opts?.strokeWidth ?? 3;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const baseR = Math.hypot(box.width, box.height) / 2;
  const r = baseR * (0.85 + 0.35 * pulse);
  const opacity = pulse;
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity.toFixed(3)}"/>`;
}

/**
 * Rectangular flash / highlight (Indicate-ish).
 */
export function rect(box: IndicateBox, progress: number, opts?: {
  color?: string;
  padding?: number;
}): string {
  const pulse = easePulse(progress);
  if (pulse <= 0.001) return "";
  const color = opts?.color ?? "rgba(251,191,36,0.35)";
  const pad = opts?.padding ?? 8;
  const grow = pad * pulse;
  return `<rect x="${(box.x - grow).toFixed(1)}" y="${(box.y - grow).toFixed(1)}" width="${(box.width + grow * 2).toFixed(1)}" height="${(box.height + grow * 2).toFixed(1)}" fill="${color}" rx="6" opacity="${pulse.toFixed(3)}"/>`;
}

/**
 * Brief full-box flash (Flash).
 */
export function flash(box: IndicateBox, progress: number, opts?: { color?: string }): string {
  const t = clamp01(progress);
  // sharp peak early
  const peak = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
  if (peak <= 0.001) return "";
  const color = opts?.color ?? "rgba(255,255,255,0.45)";
  return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${color}" opacity="${peak.toFixed(3)}"/>`;
}

/**
 * CSS transform for a wiggle (apply on an HTML/SVG group style).
 * Returns style fragment: transform + optional opacity.
 */
export function wiggle(progress: number, opts?: {
  amplitude?: number;
  cycles?: number;
}): { transform: string; style: string; angle: number } {
  const t = clamp01(progress);
  const amp = opts?.amplitude ?? 8; // degrees
  const cycles = opts?.cycles ?? 2;
  // envelope
  const env = Math.sin(t * Math.PI);
  const angle = Math.sin(t * Math.PI * 2 * cycles) * amp * env;
  const transform = `rotate(${angle.toFixed(2)}deg)`;
  const style = `transform:${transform};transform-origin:center center;`;
  return { transform, style, angle };
}

export const indicate = {
  circle,
  rect,
  flash,
  wiggle,
};

export default indicate;
