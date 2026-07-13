// Shared types, design tokens, and helpers for the social templates
// (tweet + thread). Design language: floating card on a tinted canvas,
// monochrome metrics, a single accent color.

import type { RenderContext } from "superimg";

type Std = RenderContext<Record<string, unknown>>["std"];

// ---------------------------------------------------------------------------
// Types (flat, JSON-friendly, typed unions)
// ---------------------------------------------------------------------------

/** A social author. avatar is optional → initials fallback is rendered. */
export interface Author {
  name: string;
  /** Handle without the leading @ (a leading @ is stripped if present). */
  handle: string;
  /** Optional. Omit for an auto-generated initials avatar (no network needed). */
  avatar?: string;
  /** Verification style. */
  verified?: "none" | "blue" | "gold" | "gray" | "business";
}

/** One media attachment. Grid layout is derived from count (1–4). */
export interface Media {
  src: string;
  /** default "photo" */
  kind?: "photo" | "video";
  /** poster/thumbnail for kind:"video" */
  poster?: string;
  alt?: string;
}

/** Engagement counts. All optional — the metrics row renders what's present. */
export interface TweetStats {
  replies?: number;
  reposts?: number;
  likes?: number;
  views?: number;
}

export type SocialTheme = "dark" | "light";
export type SocialPlatform = "x" | "mastodon" | "bluesky" | "generic";
/** How the metrics row renders. */
export type MetricsDisplay = "full" | "compact" | "none";

/** Optional "made with" watermark / CTA. */
export interface Brand {
  /** e.g. "@yourhandle" (@ optional, normalized in render) */
  handle?: string;
  /** e.g. "Made with SuperImg" */
  label?: string;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

export interface SocialTokens {
  canvasTop: string;
  canvasBot: string;
  surface: string;
  surfaceInset: string;
  border: string;
  divider: string;
  text: string;
  muted: string;
  metricIcon: string;
  shadow: string;
  accent: string;
  /** Near-canvas tone for the ghosted X glyph backdrop. */
  ghost: string;
}

// X brand palette: "Lights Out" dark, X light, Chirp-adjacent type, #1D9BF0 blue.
export function socialTokens(theme: SocialTheme, accent?: string): SocialTokens {
  if (theme === "light") {
    return {
      canvasTop: "#F7F9F9",
      canvasBot: "#F7F9F9",
      surface: "#FFFFFF",
      surfaceInset: "#F7F9F9",
      border: "#EFF3F4",
      divider: "#EFF3F4",
      text: "#0F1419",
      muted: "#536471",
      metricIcon: "#536471",
      shadow: "0 24px 60px -24px rgba(15,20,25,0.22)",
      accent: accent ?? "#1D9BF0",
      ghost: "#F1F4F5",
    };
  }
  return {
    canvasTop: "#000000",
    canvasBot: "#000000",
    surface: "#16181C",
    surfaceInset: "#1D1F23",
    border: "#2F3336",
    divider: "#2F3336",
    text: "#E7E9EA",
    muted: "#71767B",
    metricIcon: "#71767B",
    shadow: "none",
    accent: accent ?? "#1D9BF0",
    ghost: "#101214",
  };
}

/** Canvas background: flat, X-style (lights-out black / off-white). */
export function canvasBackground(t: SocialTokens, _std: Std, _glowAlpha: number): string {
  return t.canvasTop;
}

/** Adaptive hero type scale (px @ 1080p full-bleed frames) by character count. */
export function heroFontSize(len: number): number {
  if (len <= 70) return 100;
  if (len <= 130) return 84;
  if (len <= 200) return 68;
  if (len <= 280) return 56;
  return 46;
}

export const SOCIAL_FONTS = ["Archivo:wght@400;500;600;700;900"];
export const FONT_FAMILY = "'Archivo', system-ui, -apple-system, sans-serif";

/**
 * The signature backdrop: a massive X glyph in near-canvas tone, cropped by
 * the frame edge. Pure depth, zero color.
 */
export function ghostGlyph(t: SocialTokens, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="position:absolute;right:${-size * 0.22}px;bottom:${-size * 0.3}px;pointer-events:none">
    <path d="M14.2 10.2 21.6 2h-2.1l-6.3 7.1L8.2 2H2l7.8 11.1L2 22h2.1l6.7-7.6 5.3 7.6H22l-7.8-11.8zM12 13.2l-.8-1.1L5 3.6h2.6l5 7 .8 1.1 6.4 9.1h-2.6l-5.2-7.6z" fill="${t.ghost}"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function stripAt(handle: string): string {
  return handle.replace(/^@/, "");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Escape HTML, then color @mentions, #hashtags, and URLs in accent. */
export function linkify(text: string, accent: string, std: Std): string {
  const escaped = std.text.escapeHtml(text);
  return escaped
    .replace(
      /(^|\s)(@[A-Za-z0-9_]+|#[A-Za-z0-9_]+|https?:\/\/\S+)/g,
      (_m, pre: string, tok: string) => `${pre}<span style="color:${accent}">${tok}</span>`,
    );
}

/**
 * Deterministic greedy wrap used by both resolve() and render() so the
 * line-reveal beat count can never drift from what is drawn.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Chars per wrapped hero line at the adaptive font size (landscape column). */
export function heroCharsPerLine(len: number): number {
  return clamp(Math.round(3100 / heroFontSize(len)), 16, 52);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Avatar (initials fallback — zero network)
// ---------------------------------------------------------------------------

export function avatarHtml(author: Author, size: number, std: Std): string {
  if (author.avatar) {
    return `<img src="${author.avatar}" crossorigin="anonymous" style="${std.css({
      width: size,
      height: size,
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0,
    })}" />`;
  }
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Monochrome-blue chip, X-brand: hash varies depth, never hue.
  const h = [...author.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const l1 = 50 + (h % 10);
  const c1 = `hsl(203 82% ${l1}%)`;
  const c2 = `hsl(206 74% ${l1 - 16}%)`;
  return `<div style="${std.css({
    width: size,
    height: size,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: Math.round(size * 0.4),
    flexShrink: 0,
  })}">${initials}</div>`;
}

// ---------------------------------------------------------------------------
// Badges & icons (inline SVG, monochrome except accent/gold)
// ---------------------------------------------------------------------------

const VERIFIED_COLORS: Record<string, string> = {
  blue: "", // resolved to accent at call time
  gold: "#F4B400",
  gray: "#8A93A3",
  business: "#8A93A3",
};

export function verifiedBadge(
  kind: NonNullable<Author["verified"]>,
  size: number,
  accent: string,
): string {
  if (kind === "none") return "";
  const fill = kind === "blue" ? accent : VERIFIED_COLORS[kind]!;
  const rounding = kind === "business" ? 3 : 12; // square-ish seal for business
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex-shrink:0"><rect x="2" y="2" width="20" height="20" rx="${rounding}" fill="${fill}"/><path d="M7.2 12.4l3 3 6.4-6.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
}

export function platformGlyph(platform: SocialPlatform, size: number, color: string): string {
  const paths: Record<SocialPlatform, string> = {
    x: `<path d="M14.2 10.2 21.6 2h-2.1l-6.3 7.1L8.2 2H2l7.8 11.1L2 22h2.1l6.7-7.6 5.3 7.6H22l-7.8-11.8zM12 13.2l-.8-1.1L5 3.6h2.6l5 7 .8 1.1 6.4 9.1h-2.6l-5.2-7.6z" fill="${color}"/>`,
    mastodon: `<path d="M21.6 8.2c0-4.3-2.8-5.6-2.8-5.6C17.4 2 15 1.8 12.5 1.8h-.1c-2.5 0-4.9.2-6.3.8 0 0-2.8 1.3-2.8 5.6l-.1 2.5c0 4.2.8 8.4 4.8 9.5 1.8.5 3.4.6 4.7.5 2.3-.1 3.6-.8 3.6-.8l-.1-1.7s-1.6.5-3.5.5c-1.8-.1-3.8-.2-4.1-2.5v-.6s1.8.4 4.1.5c1.4.1 2.7-.1 4-.2 2.5-.3 4.7-1.9 5-3.3.4-2.2.4-5.4.4-5.4zm-3.4 5.6h-2.1V8.7c0-1.1-.4-1.6-1.3-1.6-1 0-1.5.6-1.5 1.9v2.7h-2.1V9c0-1.3-.5-1.9-1.5-1.9-.9 0-1.3.5-1.3 1.6v5.1H6.3V8.5c0-1.1.3-1.9.8-2.6.6-.6 1.4-1 2.4-1 1.1 0 2 .4 2.5 1.3l.5.9.6-.9c.5-.9 1.4-1.3 2.5-1.3 1 0 1.8.4 2.4 1 .5.7.8 1.5.8 2.6v5.3z" fill="${color}"/>`,
    bluesky: `<path d="M5.3 3.4C7.6 5.1 10 8.6 12 10.5c1.9-1.9 4.3-5.4 6.7-7.1C20.4 2.1 23 1.2 23 4.3c0 .6-.4 5.2-.6 5.9-.7 2.6-3.2 3.2-5.5 2.9 3.9.7 4.9 2.9 2.8 5.1-4.1 4.2-5.9-1-7.5-2.4-.1-.1-.2-.2-.2-.2s-.1.1-.2.2c-1.6 1.4-3.4 6.6-7.5 2.4-2.1-2.2-1.1-4.4 2.8-5.1-2.3.3-4.8-.3-5.5-2.9C1.4 9.5 1 4.9 1 4.3c0-3.1 2.6-2.2 4.3-.9z" fill="${color}"/>`,
    generic: `<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm-5 8h10v2H7v-2zm0-4h10v2H7V6zm0 8h7v2H7v-2z" fill="${color}"/>`,
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex-shrink:0">${paths[platform]}</svg>`;
}

const METRIC_ICONS: Record<string, string> = {
  replies:
    "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
  reposts:
    "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z",
  likes:
    "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
  views: "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z",
};

const METRIC_ORDER = ["replies", "reposts", "likes", "views"] as const;

/**
 * Monochrome metrics row. `values` holds the (possibly mid-count-up) numbers
 * to display; only keys present in `stats` render.
 */
export function metricsRow(
  stats: TweetStats,
  values: Record<string, number>,
  display: MetricsDisplay,
  t: SocialTokens,
  std: Std,
  opts: { iconSize: number; fontSize: number; gap: number },
): string {
  if (display === "none") return "";
  const present = METRIC_ORDER.filter((k) => typeof stats[k] === "number");
  if (present.length === 0) return "";

  if (display === "compact") {
    const parts = present.map((k) => std.text.formatCompact(values[k] ?? 0));
    return `<div style="${std.css({
      fontSize: opts.fontSize,
      fontWeight: 600,
      color: t.muted,
      fontVariantNumeric: "tabular-nums",
    })}">${parts.join(" · ")}</div>`;
  }

  const items = present
    .map(
      (k) => `<div style="${std.css({ display: "flex", alignItems: "center", gap: 12 })}">
        <svg width="${opts.iconSize}" height="${opts.iconSize}" viewBox="0 0 24 24" fill="${t.metricIcon}"><path d="${METRIC_ICONS[k]}"/></svg>
        <span style="${std.css({
          fontSize: opts.fontSize,
          fontWeight: 600,
          color: t.muted,
          fontVariantNumeric: "tabular-nums",
        })}">${std.text.formatCompact(values[k] ?? 0)}</span>
      </div>`,
    )
    .join("");
  return `<div style="${std.css({ display: "flex", alignItems: "center", gap: opts.gap })}">${items}</div>`;
}

// ---------------------------------------------------------------------------
// Brand watermark
// ---------------------------------------------------------------------------

export function brandWatermark(
  brand: Brand | undefined,
  t: SocialTokens,
  std: Std,
  fontSize: number,
): string {
  if (!brand || (!brand.handle && !brand.label)) return "";
  const handle = brand.handle ? `@${stripAt(brand.handle)}` : "";
  const label = brand.label ?? "";
  const sep = handle && label ? " · " : "";
  return `<div style="${std.css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize,
    fontWeight: 500,
    color: t.muted,
    letterSpacing: "0.01em",
  })}">
    <div style="${std.css({ width: 8, height: 8, borderRadius: "50%", background: t.accent, flexShrink: 0 })}"></div>
    <span>${std.text.escapeHtml(handle)}${sep}${std.text.escapeHtml(label)}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Media grid (1 full / 2 side-by-side / 3 big+column / 4 grid)
// ---------------------------------------------------------------------------

function mediaCell(m: Media, t: SocialTokens, std: Std, style: Record<string, unknown>): string {
  const kind = m.kind ?? "photo";
  const src = kind === "video" ? (m.poster ?? m.src) : m.src;
  const playBadge =
    kind === "video"
      ? `<div style="${std.css({ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" })}">
          <div style="${std.css({ width: 56, height: 56, background: "rgba(0,0,0,0.55)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" })}">
            <div style="width:0;height:0;border-left:20px solid #fff;border-top:12px solid transparent;border-bottom:12px solid transparent;margin-left:5px"></div>
          </div>
        </div>`
      : "";
  return `<div style="${std.css({
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    border: `1px solid ${t.border}`,
    ...style,
  })}">
    <img src="${src}" crossorigin="anonymous" alt="${std.text.escapeHtml(m.alt ?? "")}" style="${std.css({ width: "100%", height: "100%", objectFit: "cover", display: "block" })}" />
    ${playBadge}
  </div>`;
}

export function mediaGrid(
  media: Media[],
  t: SocialTokens,
  std: Std,
  opts: { maxHeight: number; gap?: number },
): string {
  const items = media.slice(0, 4);
  if (items.length === 0) return "";
  const gap = opts.gap ?? 14;
  const h = opts.maxHeight;

  if (items.length === 1) {
    return mediaCell(items[0]!, t, std, { width: "100%", height: h });
  }
  if (items.length === 2) {
    const cells = items.map((m) => mediaCell(m, t, std, { flex: 1, minWidth: 0, height: h }));
    return `<div style="${std.css({ display: "flex", gap })}">${cells.join("")}</div>`;
  }
  if (items.length === 3) {
    const big = mediaCell(items[0]!, t, std, { flex: 2, minWidth: 0, height: h });
    const col = items
      .slice(1)
      .map((m) => mediaCell(m, t, std, { flex: 1, minHeight: 0 }))
      .join("");
    return `<div style="${std.css({ display: "flex", gap })}">
      ${big}
      <div style="${std.css({ flex: 1, minWidth: 0, height: h, display: "flex", flexDirection: "column", gap })}">${col}</div>
    </div>`;
  }
  const cells = items.map((m) => mediaCell(m, t, std, { minHeight: 0 }));
  return `<div style="${std.css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap,
    height: h,
  })}">${cells.join("")}</div>`;
}
