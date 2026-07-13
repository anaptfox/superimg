// Tweet — one post, typeset full-bleed like X's own brand campaigns.
// Demonstrates: resolve() + layoutTimeline (content-scaled duration),
// director beats with a designed exit, std.text.type/cursor (pure typewriter),
// responsive outputs (16:9 / 1:1 / 9:16), zero-network sample data.

import { define, layoutTimeline, type RenderContext } from "superimg";
import {
  avatarHtml,
  brandWatermark,
  canvasBackground,
  clamp,
  FONT_FAMILY,
  formatDate,
  ghostGlyph,
  heroCharsPerLine,
  heroFontSize,
  linkify,
  mediaGrid,
  metricsRow,
  platformGlyph,
  SOCIAL_FONTS,
  socialTokens,
  stripAt,
  verifiedBadge,
  wordCount,
  wrapText,
  type Author,
  type Brand,
  type Media,
  type MetricsDisplay,
  type SocialPlatform,
  type SocialTheme,
  type TweetStats,
} from "../_shared/social";

export interface TweetVideoData extends Record<string, unknown> {
  // ---- content ----
  author: Author;
  text: string;
  /** ISO date or any Date-parseable string. Optional. */
  createdAt?: string;
  /** All counts optional; the metrics row renders what's present. */
  stats?: TweetStats;
  /** Optional. 0–4 attachments; grid layout derived from count. */
  media?: Media[];
  /** Optional quoted post. */
  quote?: { author: Author; text: string };

  // ---- presentation (all optional, smart defaults) ----
  /** default "dark" */
  theme?: SocialTheme;
  /** hex accent; themed default when omitted */
  accent?: string;
  /** header glyph; default "x" */
  platform?: SocialPlatform;
  /** metrics row style; default "full" */
  metrics?: MetricsDisplay;
  /** text animation; default "lines" (line-by-line fade-up), "type" = typewriter */
  reveal?: "lines" | "type";
  /** optional watermark / CTA */
  brand?: Brand;
}

/**
 * Seconds per beat → percent phases. Called from both resolve() and render()
 * so job duration and director phases always match.
 */
function estimate(data: TweetVideoData) {
  const text = (data.text ?? "").trim();
  const reveal = data.reveal ?? "lines";
  const hasText = text.length > 0;
  const hasMedia = (data.media?.length ?? 0) > 0 || !!data.quote;
  const stats = data.stats ?? {};
  const hasMetrics =
    (data.metrics ?? "full") !== "none" &&
    Object.values(stats).some((v) => typeof v === "number");

  const lineCount = hasText ? wrapText(text, heroCharsPerLine(text.length)).length : 0;
  const textSec = !hasText
    ? 0
    : reveal === "type"
      ? clamp(text.length / 32, 1.4, 5.5)
      : clamp(0.5 + 0.12 * lineCount, 0.6, 1.4);
  // Typewriter is read while it types; line reveal needs reading time after it.
  // The text is settled (readable) through the media + metrics beats too, so
  // only the remainder of max(0.8s, words÷3) lands in the hold.
  const readSec = 0.8 + wordCount(text) / 3;
  const settledBeforeHold = (hasMedia ? 0.55 : 0) + (hasMetrics ? 1.1 : 0);
  const holdSec =
    reveal === "type" || !hasText ? 1.7 : clamp(readSec - settledBeforeHold, 1.7, 8);

  const segments: Record<string, number> = { author: 0.7 };
  if (hasText) segments.text = textSec;
  if (hasMedia) segments.media = 0.55;
  if (hasMetrics) segments.metrics = 1.1;
  segments.hold = holdSec;
  segments.exit = 0.5;

  return {
    ...layoutTimeline(segments),
    hasText,
    hasMedia,
    hasMetrics,
    textSec,
    lineCount,
  };
}

export default define<TweetVideoData>({
  sample: {
    author: { name: "Maya Chen", handle: "mayabuilds", verified: "blue" },
    text: "Just shipped my first video rendered entirely from HTML and CSS. No keyframes, no timeline — just code that returns a frame.",
    createdAt: "2026-07-12T15:30:00.000Z",
    stats: { replies: 1200, reposts: 340, likes: 8400, views: 210000 },
    theme: "dark",
    platform: "x",
    metrics: "full",
    reveal: "lines",
    brand: { handle: "@superimg", label: "Made with SuperImg" },
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s", // AST fallback; resolve() overrides from content
    fonts: SOCIAL_FONTS,
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    },
    inlineCss: [
      `* { margin: 0; padding: 0; box-sizing: border-box; }
       body { font-family: ${FONT_FAMILY}; overflow: hidden; }`,
    ],
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimate(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<TweetVideoData>) {
    const { std, width, height, timeline, data, isPortrait } = ctx;
    const {
      author,
      createdAt,
      stats = {},
      media = [],
      quote,
      theme = "dark",
      accent,
      platform = "x",
      metrics = "full",
      reveal = "lines",
      brand,
    } = data;
    const text = (data.text ?? "").trim();

    const est = estimate(data);
    const t = ctx.director(est.phases);
    const tk = socialTokens(theme, accent);
    const r = std.createResponsive(ctx);

    // ---- scale & frame ----
    const s = r({ portrait: 0.72, square: 0.8, default: 1 });
    const marginX = Math.round(width * (isPortrait ? 0.085 : 0.073));
    const colWidth = width - marginX * 2;
    const heroSize = Math.round(heroFontSize(text.length) * s);
    const charsPerLine = Math.max(14, Math.floor(colWidth / (heroSize * 0.53)));

    // ---- beats ----
    const enterP = t.in("author");
    const headerP = std.stagger.ms(2, enterP, { windowSeconds: 0.7, eachMs: 60, capMs: 120 });
    const textP = est.hasText ? t.in("text") : 1;
    const mediaP = est.hasMedia
      ? std.interpolate(t.in("media"), [0, 0.85], [0, 1], "easeOutCubic")
      : 1;
    const metricsOpacity = est.hasMetrics
      ? std.interpolate(t.in("metrics"), [0, 0.25], [0, 1], "easeOutCubic")
      : 1;
    const exitP = std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");
    const ghostOpacity = std.interpolate(enterP, [0, 1], [0, 1], "easeOutCubic");

    const headerItem = (i: number) => {
      const p = headerP[i] ?? 1;
      return std.css({
        opacity: p,
        transform: `translateY(${std.interpolate(p, [0, 1], [-14, 0], "easeOutCubic")}px)`,
      });
    };

    // ---- hero text (the billboard) ----
    const heroStyle = std.css({
      fontSize: heroSize,
      fontWeight: 700,
      lineHeight: 1.16,
      letterSpacing: "-0.025em",
      color: tk.text,
    });
    let heroHtml = "";
    if (est.hasText) {
      if (reveal === "type") {
        const rev = std.text.type(text, textP, { by: "char", variance: 0.4 });
        const showCursor =
          t.active === "text" && (rev.typing || std.text.cursor(timeline.seconds, 2));
        const cursor = showCursor ? `<span style="color:${tk.accent}">▍</span>` : "";
        heroHtml = `<div style="${heroStyle}; white-space:pre-wrap; word-wrap:break-word">${linkify(rev.visible, tk.accent, std)}${cursor}</div>`;
      } else {
        const lines = wrapText(text, charsPerLine);
        const lineP = std.stagger.ms(lines.length, textP, {
          windowSeconds: est.textSec,
          eachMs: 60,
          capMs: 300,
        });
        const lineHtml = lines
          .map((line, i) => {
            const p = lineP[i] ?? 1;
            return `<div style="${std.css({
              opacity: p,
              transform: `translateY(${std.interpolate(p, [0, 1], [16, 0], "easeOutCubic")}px)`,
            })}">${linkify(line, tk.accent, std) || "&nbsp;"}</div>`;
          })
          .join("");
        heroHtml = `<div style="${heroStyle}">${lineHtml}</div>`;
      }
    }

    // ---- media + quote (share the media beat) ----
    const mediaStyle = std.css({
      opacity: mediaP,
      transform: `translateY(${(1 - mediaP) * 16}px)`,
    });
    const mediaHtml =
      media.length > 0
        ? `<div style="${std.css({ marginTop: 44 * s, maxWidth: Math.min(colWidth, 1240 * s) })}; ${mediaStyle}">${mediaGrid(media, tk, std, {
            maxHeight: Math.round((media.length === 1 ? 460 : 380) * s),
          })}</div>`
        : "";
    const quoteHtml = quote
      ? `<div style="${std.css({
          marginTop: 44 * s,
          paddingLeft: 32 * s,
          borderLeft: `3px solid ${tk.border}`,
          maxWidth: Math.min(colWidth, 1240 * s),
        })}; ${mediaStyle}">
          <div style="${std.css({ display: "flex", alignItems: "center", gap: 12 })}">
            ${avatarHtml(quote.author, Math.round(40 * s), std)}
            <span style="${std.css({ fontSize: 26 * s, fontWeight: 700, color: tk.text })}">${std.text.escapeHtml(quote.author.name)}</span>
            ${verifiedBadge(quote.author.verified ?? "none", Math.round(22 * s), tk.accent)}
            <span style="${std.css({ fontSize: 24 * s, fontWeight: 500, color: tk.muted })}">@${std.text.escapeHtml(stripAt(quote.author.handle))}</span>
          </div>
          <div style="${std.css({ fontSize: 34 * s, fontWeight: 500, lineHeight: 1.35, color: tk.muted, marginTop: 14 * s })}">${linkify(quote.text, tk.accent, std)}</div>
        </div>`
      : "";

    // ---- metrics rail (count-up settles ~0.2s before the beat ends) ----
    const countUp = (v: number | undefined) =>
      typeof v === "number" && est.hasMetrics
        ? Math.floor(t.tween(0, v, { during: "metrics", at: "0.1s", for: "0.9s", easing: "easeOutQuart" }))
        : (v ?? 0);
    const values = {
      replies: countUp(stats.replies),
      reposts: countUp(stats.reposts),
      likes: countUp(stats.likes),
      views: countUp(stats.views),
    };
    const metricsHtml = metricsRow(stats, values, metrics, tk, std, {
      iconSize: Math.round(28 * s),
      fontSize: Math.round(28 * s),
      gap: Math.round(56 * s),
    });
    const brandHtml = brandWatermark(brand, tk, std, Math.round(24 * s));
    const footerHtml =
      metricsHtml || brandHtml
        ? `<div style="${std.css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            paddingTop: 36 * s,
            borderTop: `1px solid ${tk.divider}`,
            opacity: metricsOpacity,
          })}">${metricsHtml}${brandHtml}</div>`
        : "";

    // ---- author eyebrow ----
    const date = createdAt ? formatDate(createdAt) : "";
    const headerHtml = `<div style="${std.css({ display: "flex", alignItems: "center", gap: 22 * s })}">
      <div style="${headerItem(0)}">${avatarHtml(author, Math.round(72 * s), std)}</div>
      <div style="${std.css({ flex: 1, minWidth: 0 })}; ${headerItem(1)}">
        <div style="${std.css({ display: "flex", alignItems: "center", gap: 10 })}">
          <span style="${std.css({ fontSize: 34 * s, fontWeight: 700, letterSpacing: "-0.01em", color: tk.text })}">${std.text.escapeHtml(author.name)}</span>
          ${verifiedBadge(author.verified ?? "none", Math.round(27 * s), tk.accent)}
        </div>
        <div style="${std.css({ fontSize: 24 * s, fontWeight: 500, color: tk.muted, marginTop: 2 })}">@${std.text.escapeHtml(stripAt(author.handle))}${date ? ` · ${date}` : ""}</div>
      </div>
      <div style="${headerItem(1)}">${platformGlyph(platform, Math.round(34 * s), tk.metricIcon)}</div>
    </div>`;

    // ---- composition: eyebrow / billboard / rail, over the ghost glyph ----
    const exitStyle = std.css({
      opacity: 1 - exitP,
      transform: `translateY(${exitP * 10}px)`,
    });
    return `<div style="${std.css({
      width,
      height,
      background: canvasBackground(tk, std, 0),
      position: "relative",
      overflow: "hidden",
    })}">
      <div style="${std.css({ opacity: ghostOpacity })}">${ghostGlyph(tk, Math.round(Math.max(width, height) * 1.05))}</div>
      <div style="${std.css({
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        paddingTop: isPortrait ? height * 0.14 : 100 * s,
        paddingBottom: isPortrait ? height * 0.2 : 100 * s,
        paddingLeft: marginX,
        paddingRight: marginX,
      })}; ${exitStyle}">
        ${headerHtml}
        <div style="${std.css({ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0, paddingTop: 40 * s, paddingBottom: 40 * s })}">
          ${heroHtml}${quoteHtml}${mediaHtml}
        </div>
        ${footerHtml}
      </div>
    </div>`;
  },
});
