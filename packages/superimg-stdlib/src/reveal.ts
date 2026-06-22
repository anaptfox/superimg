/**
 * Shared reveal / transition FX for within-scene composition.
 *
 * Progress contract: `progress` is transition completion (0 → 1).
 * - Cover overlays (wipe, iris): 0 = fully obscured, 1 = fully revealed.
 * - Uncover overlays (curtain): 0 = hidden, 1 = fully covering.
 * - Scene handoffs (split, crossfade): 0 = from, 1 = to.
 */

import { css } from "./css.js";
import { clamp01 } from "./easing.js";
import { interpolate } from "./interpolate.js";

export type WipeDirection = "left" | "right" | "up" | "down" | "diagonal";

export type SplitStyle = "wipe" | "slide" | "flip" | "split";

export interface RevealResult {
  html: string;
  active: boolean;
  progress: number;
}

export interface WipeOptions {
  progress: number;
  direction?: WipeDirection;
  color?: string;
}

export interface CurtainOptions {
  progress: number;
  direction?: "up" | "down" | "left" | "right";
  color?: string;
}

export interface CrossfadeOptions {
  progress: number;
  from: string;
  to: string;
}

export interface SplitOptions {
  from: string;
  to: string;
  progress: number;
  style?: SplitStyle;
  accentColor?: string;
}

export interface HandoffLocalOptions {
  /** Target phase local progress at completion (default 0.1) */
  peek?: number;
}

function isMidTransition(progress: number): boolean {
  return progress > 0 && progress < 1;
}

export function wipe(options: WipeOptions): RevealResult {
  const { progress, direction = "left", color = "#000" } = options;
  const p = clamp01(progress);
  const cover = 1 - p;
  const active = p < 1;

  let clipPath: string;
  if (direction === "diagonal") {
    const offset = interpolate(cover, [0, 1], [-50, 100], "easeInOutCubic");
    clipPath = `polygon(0 0, ${offset + 50}% 0, ${offset}% 100%, 0 100%)`;
  } else if (direction === "right") {
    const x = interpolate(cover, [0, 1], [100, -100]);
    clipPath = `polygon(${x}% 0, 100% 0, 100% 100%, ${x - 50}% 100%)`;
  } else if (direction === "up") {
    const y = interpolate(cover, [0, 1], [100, -100]);
    clipPath = `polygon(0 ${y}%, 100% ${y - 50}%, 100% 100%, 0 100%)`;
  } else if (direction === "down") {
    const y = interpolate(cover, [0, 1], [-100, 100]);
    clipPath = `polygon(0 0, 100% 0, 100% ${y + 50}%, 0 ${y}%)`;
  } else {
    const offset = interpolate(cover, [0, 1], [-50, 100], "easeInOutCubic");
    clipPath = `polygon(0 0, ${offset + 50}% 0, ${offset}% 100%, 0 100%)`;
  }

  const html = `<div style="${css({
    position: "absolute",
    inset: 0,
    background: color,
    clipPath,
    pointerEvents: "none",
  })}"></div>`;

  return { html, active, progress: p };
}

export function curtain(options: CurtainOptions): RevealResult {
  const { progress, direction = "up", color = "#000" } = options;
  const p = clamp01(progress);
  const active = p > 0;

  let clipPath: string;
  if (direction === "down") {
    const y = interpolate(p, [0, 1], [0, 100]);
    clipPath = `inset(0 0 ${100 - y}% 0)`;
  } else if (direction === "left") {
    const x = interpolate(p, [0, 1], [0, 100]);
    clipPath = `inset(0 ${100 - x}% 0 0)`;
  } else if (direction === "right") {
    const x = interpolate(p, [0, 1], [0, 100]);
    clipPath = `inset(0 0 0 ${100 - x}%)`;
  } else {
    const y = interpolate(p, [0, 1], [0, 100]);
    clipPath = `inset(${100 - y}% 0 0 0)`;
  }

  const html = `<div style="${css({
    position: "absolute",
    inset: 0,
    background: color,
    clipPath,
    pointerEvents: "none",
  })}"></div>`;

  return { html, active, progress: p };
}

export function crossfade(options: CrossfadeOptions): RevealResult {
  const { progress, from, to } = options;
  const p = clamp01(progress);
  const active = isMidTransition(p);

  const html = `
    <div style="${css({ position: "absolute", inset: 0 })}">
      <div style="${css({ position: "absolute", inset: 0, opacity: 1 - p })}">${from}</div>
      <div style="${css({ position: "absolute", inset: 0, opacity: p })}">${to}</div>
    </div>
  `;

  return { html, active, progress: p };
}

export function split(options: SplitOptions): RevealResult {
  const { from, to, progress, style = "wipe", accentColor = "#3b82f6" } = options;
  const p = clamp01(progress);
  const active = isMidTransition(p);

  let html: string;

  if (style === "wipe") {
    const wipePosition = p * 100;
    html = `
      <div style="${css({ position: "absolute", inset: 0, overflow: "hidden" })}">
        <div style="${css({ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - wipePosition}% 0 0)` })}">${to}</div>
        <div style="${css({ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${wipePosition}%)` })}">${from}</div>
        <div style="${css({
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${wipePosition}%`,
          width: 4,
          background: accentColor,
          transform: "translateX(-50%)",
          boxShadow: `0 0 30px ${accentColor}`,
          opacity: isMidTransition(p) ? 1 : 0,
          zIndex: 10,
        })}"></div>
      </div>
    `;
  } else if (style === "slide") {
    const fromX = -p * 120;
    const toX = (1 - p) * 120;
    html = `
      <div style="${css({ position: "absolute", inset: 0, overflow: "hidden" })}">
        <div style="${css({ position: "absolute", inset: 0, transform: `translateX(${fromX}%)`, opacity: 1 - p })}">${from}</div>
        <div style="${css({ position: "absolute", inset: 0, transform: `translateX(${toX}%)`, opacity: p })}">${to}</div>
      </div>
    `;
  } else if (style === "flip") {
    const rotateY = p * 180;
    html = `
      <div style="${css({ position: "absolute", inset: 0, perspective: 2000 })}">
        <div style="width:100%;height:100%;position:relative;transform-style:preserve-3d;transform:rotateY(${rotateY}deg)">
          <div style="${css({ position: "absolute", inset: 0, backfaceVisibility: "hidden" })}">${from}</div>
          <div style="${css({ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" })}">${to}</div>
        </div>
      </div>
    `;
  } else {
    const gap = 2;
    const splitAt = p * 100;
    html = `
      <div style="${css({ position: "absolute", inset: 0, display: "flex", gap })}">
        <div style="${css({ flex: `0 0 ${splitAt}%`, overflow: "hidden" })}">${from}</div>
        <div style="${css({ flex: 1, overflow: "hidden" })}">${to}</div>
      </div>
    `;
  }

  return { html, active, progress: p };
}

export function iris(options: { progress: number; color?: string }): RevealResult {
  const { progress, color = "#000" } = options;
  const p = clamp01(progress);
  const cover = 1 - p;
  const radius = interpolate(cover, [0, 1], [0, 75]);
  const active = p < 1;

  const html = `<div style="${css({
    position: "absolute",
    inset: 0,
    background: color,
    clipPath: `circle(${radius}% at 50% 50%)`,
    pointerEvents: "none",
  })}"></div>`;

  return { html, active, progress: p };
}

/**
 * Map handoff transition progress to target phase local progress.
 * Use for frozen "to" panels during crossfade/split (e.g. buildCtaShot(handoffLocal(p))).
 */
export function handoffLocal(progress: number, options: HandoffLocalOptions = {}): number {
  const p = clamp01(progress);
  return p * (options.peek ?? 0.1);
}

/** Namespace object for std.reveal */
export const revealFx = { wipe, curtain, crossfade, split, iris, handoffLocal };