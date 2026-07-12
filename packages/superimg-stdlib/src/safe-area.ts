/**
 * Broadcast-safe, title-safe, action-safe, and social chrome insets.
 */

export type AspectKind = "landscape" | "portrait" | "square";

export type SafeAreaPreset =
  | "broadcast"
  | "none"
  | "title"
  | "action"
  | "social"
  | "social-center";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type Frac = { top: number; right: number; bottom: number; left: number };

/** Title-safe ~90% vertical, action-safe ~90% horizontal (broadcast convention). */
const BROADCAST: Record<AspectKind, Frac> = {
  landscape: { top: 0.1, right: 0.05, bottom: 0.1, left: 0.05 },
  portrait: { top: 0.12, right: 0.06, bottom: 0.14, left: 0.06 },
  square: { top: 0.1, right: 0.08, bottom: 0.1, left: 0.08 },
};

/** Central ~80% for text (title-safe). */
const TITLE: Record<AspectKind, Frac> = {
  landscape: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
  portrait: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
  square: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
};

/** Central ~90% for graphics (action-safe). */
const ACTION: Record<AspectKind, Frac> = {
  landscape: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
  portrait: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
  square: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
};

/**
 * Social 9:16 chrome (animator skill): top ~12% (username), bottom ~18%
 * (captions), right ~14% (engagement). Landscape/square get softer variants.
 */
const SOCIAL: Record<AspectKind, Frac> = {
  landscape: { top: 0.08, right: 0.08, bottom: 0.12, left: 0.05 },
  portrait: { top: 0.12, right: 0.14, bottom: 0.18, left: 0.06 },
  square: { top: 0.1, right: 0.1, bottom: 0.14, left: 0.08 },
};

/** Centered vertical column for Reels/TikTok. */
const SOCIAL_CENTER: Record<AspectKind, Frac> = {
  landscape: { top: 0.1, right: 0.15, bottom: 0.12, left: 0.15 },
  portrait: { top: 0.14, right: 0.16, bottom: 0.2, left: 0.16 },
  square: { top: 0.12, right: 0.14, bottom: 0.14, left: 0.14 },
};

const PRESET_TABLE: Record<Exclude<SafeAreaPreset, "none">, Record<AspectKind, Frac>> = {
  broadcast: BROADCAST,
  title: TITLE,
  action: ACTION,
  social: SOCIAL,
  "social-center": SOCIAL_CENTER,
};

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
  const table = PRESET_TABLE[preset];
  if (!table) {
    throw new Error(
      `Unknown safe-area preset "${preset}". Known: none, ${Object.keys(PRESET_TABLE).join(", ")}`,
    );
  }
  const f = table[kind];
  return {
    top: Math.round(height * f.top),
    right: Math.round(width * f.right),
    bottom: Math.round(height * f.bottom),
    left: Math.round(width * f.left),
  };
}

/** Safe content box as { x, y, width, height }. */
export function getSafeBox(
  width: number,
  height: number,
  preset: SafeAreaPreset = "broadcast",
): { x: number; y: number; width: number; height: number } {
  const i = getSafeArea(width, height, preset);
  return {
    x: i.left,
    y: i.top,
    width: Math.max(0, width - i.left - i.right),
    height: Math.max(0, height - i.top - i.bottom),
  };
}
