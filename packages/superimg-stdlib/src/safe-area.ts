/**
 * Broadcast-safe and action-safe insets for layered scenes.
 */

export type AspectKind = "landscape" | "portrait" | "square";

export type SafeAreaPreset = "broadcast" | "none";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Title-safe ~90% vertical, action-safe ~90% horizontal (broadcast convention). */
const BROADCAST = {
  landscape: { top: 0.1, right: 0.05, bottom: 0.1, left: 0.05 },
  portrait: { top: 0.12, right: 0.06, bottom: 0.14, left: 0.06 },
  square: { top: 0.1, right: 0.08, bottom: 0.1, left: 0.08 },
} as const satisfies Record<AspectKind, { top: number; right: number; bottom: number; left: number }>;

export function getAspectKind(width: number, height: number): AspectKind {
  const ratio = width / height;
  if (ratio < 0.9) return "portrait";
  if (ratio > 1.1) return "landscape";
  return "square";
}

export function getSafeArea(
  width: number,
  height: number,
  preset: SafeAreaPreset = "broadcast",
): SafeAreaInsets {
  if (preset === "none") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const kind = getAspectKind(width, height);
  const f = BROADCAST[kind];
  return {
    top: Math.round(height * f.top),
    right: Math.round(width * f.right),
    bottom: Math.round(height * f.bottom),
    left: Math.round(width * f.left),
  };
}