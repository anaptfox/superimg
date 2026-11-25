import { svgDocument, type SvgPaintEdit } from "@foxworth/superimg";
import env from "./art/env.svg?superimg-svg";
import pot from "./art/pot.svg?superimg-svg";
import cup from "./art/cup.svg?superimg-svg";
import trivet from "./art/trivet.svg?superimg-svg";
import hand from "./art/hand.svg?superimg-svg";
import stream from "./art/stream.svg?superimg-svg";
import shadow from "./art/shadow.svg?superimg-svg";

export const envDoc = svgDocument(env);
export const potDoc = svgDocument(pot);
export const cupDoc = svgDocument(cup);
export const trivetDoc = svgDocument(trivet);
export const handDoc = svgDocument(hand);
export const streamDoc = svgDocument(stream);
export const shadowDoc = svgDocument(shadow);

function innerHalfWidth(y: number) {
  const t = Math.min(1, Math.max(0, (-y - 8) / 62));
  return 22 + 28 * Math.pow(t, 0.62);
}

export function teaEdits(level: number, ripple = 0, steam = 0): Record<string, SvgPaintEdit> {
  const y = -12 - 52 * level;
  const rx = innerHalfWidth(y), ry = rx * 0.25;
  const visible = level > 0.01 ? 1 : 0;
  const r = Math.max(0, Math.min(1, ripple));
  return {
    "tea-surface": { cy: y, rx, ry, opacity: visible },
    "tea-meniscus": { cy: y, rx, ry, opacity: visible * 0.9 },
    "tea-sheen": { cx: rx * 0.38, cy: y - ry * 0.25, rx: rx * 0.32, opacity: visible * 0.85 },
    ripple: { cy: y, rx: 6 + 10 * r, ry: (6 + 10 * r) * 0.25, opacity: visible * (r > 0 ? 0.9 * (1 - r * 0.6) : 0) },
    "ripple-outer": { cy: y, rx: 14 + 16 * r, ry: (14 + 16 * r) * 0.25, opacity: visible * (r > 0 ? 0.6 * (1 - r) : 0) },
    steam: { opacity: steam },
  };
}
