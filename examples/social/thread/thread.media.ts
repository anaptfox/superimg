// Thread — a post thread as full-bleed typographic slides with a segmented
// progress rail (one segment per post) and a summary end-card.
// Demonstrates: std.carousel choreography, resolve() + layoutTimeline
// (duration scales with post count AND reading time), string-shorthand
// entries and responsive editions (16:9 / 1:1 / 9:16).

import { define, Html, layoutTimeline, type RenderContext } from "@foxworth/superimg";
import {
  avatarHtml,
  brandWatermark,
  canvasBackground,
  clamp,
  FONT_FAMILY,
  ghostGlyph,
  heroFontSize,
  linkify,
  mediaGrid,
  metricsRow,
  SOCIAL_FONTS,
  socialTokens,
  stripAt,
  verifiedBadge,
  wordCount,
  type Author,
  type Brand,
  type Media,
  type SocialTheme,
  type TweetStats,
} from "../_shared/social";

export type TransitionStyle = "slide" | "stack" | "flip";
export type PositionStyle = "counter" | "dots" | "none";

/** A thread entry. A plain string is shorthand for { text }. */
export type ThreadEntry = string | { text: string; media?: Media[]; stats?: TweetStats };

export interface ThreadData extends Record<string, unknown> {
  author: Author;
  /** Plain strings or objects; position is derived from array index. */
  tweets: ThreadEntry[];

  // ---- presentation (all optional, smart defaults) ----
  /** default "dark" */
  theme?: SocialTheme;
  /** hex accent; themed default when omitted */
  accent?: string;
  /** card transition; default "slide" */
  transition?: TransitionStyle;
  /** progress indicator; default "dots" (segmented rail). */
  position?: PositionStyle;
  /** optional watermark / CTA */
  brand?: Brand;
}

function entries(data: ThreadData): Array<{ text: string; media?: Media[]; stats?: TweetStats }> {
  return (data.tweets ?? []).map((t) => (typeof t === "string" ? { text: t } : t));
}

/**
 * Seconds per beat → percent phases. Uniform carousel slots sized so the
 * longest post can be read during its settled hold (excluding enter/exit). Called from both resolve() and render().
 */
function estimate(data: ThreadData) {
  const tweets = entries(data);
  const count = tweets.length;
  const slotSec = Math.max(
    ...tweets.map((tw) => Math.max(1.3, wordCount(tw.text) / 3) / (1 - 0.26 - 0.2)),
    1.65,
  );

  const segments: Record<string, number> = { intro: 0.8, tweets: slotSec * Math.max(1, count) };
  if (count > 1) segments.count = 1.4;
  segments.outro = 0.6;

  return { ...layoutTimeline(segments), count, slotSec, hasCount: count > 1 };
}

export default define<ThreadData>({
  editions: {
    landscape: { size: { width: 1920, height: 1080 } },
    square: { size: { width: 1080, height: 1080 } },
    story: { size: { width: 1080, height: 1920 } },
  },
  sample: {
    author: { name: "Maya Chen", handle: "mayabuilds", verified: "blue" },
    tweets: [
      "I stopped opening a video editor. Three things replaced it:",
      "1. The video is a program. Data goes in, frames come out — no timeline to scrub.",
      "2. Motion is a director: phases, springs, staggers. Nothing to nudge by hand.",
      "3. One source exports to video, images, and social sizes. Same input, same authored frame.",
    ],
    theme: "dark",
    transition: "slide",
    brand: { handle: "@superimg", label: "Made with SuperImg" },
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "9s", // AST fallback; resolve() overrides from content
    fonts: SOCIAL_FONTS,
    inlineCss: [
      `* { margin: 0; padding: 0; box-sizing: border-box; }
       body { font-family: ${FONT_FAMILY}; overflow: hidden; }`,
    ],
  },
  resolve({ data }) {
    const { totalSeconds, phases } = estimate(data);
    return { duration: `${totalSeconds}s`, phases };
  },
  render(ctx: RenderContext<ThreadData>) {
    const { std, width, height, data, isPortrait } = ctx;
    const {
      author,
      theme = "dark",
      accent,
      transition = "slide",
      position = "dots",
      brand,
    } = data;

    const tweets = entries(data);
    const est = estimate(data);
    const t = ctx.director(est.phases);
    const tk = socialTokens(theme, accent);
    const r = std.createResponsive(ctx);

    const s = r({ portrait: 0.72, square: 0.8, default: 1 });
    const marginX = Math.round(width * (isPortrait ? 0.085 : 0.073));
    const colWidth = width - marginX * 2;

    const car = std.carousel(tweets, {
      id: "posts",
      itemIds: tweets.map((tw, i) => `post-${i + 1}-${tw.text.slice(0, 24)}`),
      during: t.in("tweets"),
      enter: 0.26,
      exit: 0.2,
      last: "hold",
    });
    const tweetsP = t.in("tweets");

    // ---- persistent header (enters once, holds for the whole video) ----
    const headerIn = t.motion({ id: "header", during: "intro", at: "0s", for: "0.5s", y: -15, easing: "easeOutCubic" });
    const labelIn = t.motion({ id: "label", during: "intro", at: "0.12s", for: "0.45s", y: -10, easing: "easeOutCubic" });
    const ghostOpacity = std.interpolate(t.in("intro"), [0, 1], [0, 1], "easeOutCubic");
    const headerHtml = `<div style="${std.css({ display: "flex", alignItems: "center", gap: 20 * s })}">
      <div style="${headerIn.style}">${avatarHtml(author, Math.round(64 * s), std)}</div>
      <div style="${headerIn.style}">
        <div style="${std.css({ display: "flex", alignItems: "center", gap: 10 })}">
          <span style="${std.css({ fontSize: 30 * s, fontWeight: 700, letterSpacing: "-0.01em", color: tk.text })}">${std.text.escapeHtml(author.name)}</span>
          ${verifiedBadge(author.verified ?? "none", Math.round(24 * s), tk.accent)}
        </div>
        <div style="${std.css({ fontSize: 22 * s, fontWeight: 500, color: tk.muted, marginTop: 2 })}">@${std.text.escapeHtml(stripAt(author.handle))}</div>
      </div>
      <div style="${std.css({ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 * s })}; ${labelIn.style}">
        <div style="${std.css({ width: 9 * s, height: 9 * s, borderRadius: "50%", background: tk.accent })}"></div>
        <span style="${std.css({ fontSize: 20 * s, fontWeight: 700, letterSpacing: "0.22em", color: tk.accent, fontVariantNumeric: "tabular-nums" })}">THREAD · ${est.count}</span>
      </div>
    </div>`;

    // ---- segmented progress rail: one segment per post, fills in sequence ----
    const railHtml =
      position === "dots"
        ? `<div style="${std.css({ display: "flex", gap: 10 * s, marginTop: 30 * s, opacity: headerIn.enter })}">${tweets
            .map((_, i) => {
              const fill = clamp(tweetsP * est.count - i, 0, 1);
              return `<div style="${std.css({
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: std.color.alpha(tk.muted, 0.2),
                position: "relative",
                overflow: "hidden",
              })}"><div style="${std.css({
                position: "absolute",
                inset: 0,
                width: `${fill * 100}%`,
                background: tk.accent,
                borderRadius: 3,
              })}"></div></div>`;
            })
            .join("")}</div>`
        : "";

    // ---- per-slide transition (carousel enter/exit are pre-eased) ----
    function slideTransform(phase: string, enter: number, exit: number) {
      let transform = "";
      let opacity = 1;
      let extra = "";
      if (transition === "slide") {
        // Short travel: full-frame slides strobe at 30fps with no motion blur
        if (phase === "entering") {
          transform = `translateX(${(1 - enter) * 6}%)`;
          opacity = enter;
        } else if (phase === "exiting") {
          transform = `translateX(${-exit * 6}%)`;
          opacity = 1 - exit;
        }
      } else if (transition === "stack") {
        if (phase === "entering") {
          transform = `translateY(${(1 - enter) * 28}px) scale(${0.96 + enter * 0.04})`;
          opacity = enter;
        } else if (phase === "exiting") {
          transform = `translateY(${-exit * 16}px) scale(${1 - exit * 0.02})`;
          opacity = 1 - exit;
        }
      } else if (transition === "flip") {
        // cap at 70°: past ~75° the block is edge-on and reads as a strobe flash
        extra = "backface-visibility:hidden;";
        if (phase === "entering") {
          transform = `perspective(1200px) rotateY(${(1 - enter) * 70}deg)`;
          opacity = enter;
        } else if (phase === "exiting") {
          transform = `perspective(1200px) rotateY(${exit * -70}deg)`;
          opacity = 1 - exit;
        }
      }
      return { transform, opacity, extra };
    }

    // ---- slides ----
    let slidesHtml = "";
    for (let i = 0; i < tweets.length; i++) {
      const item = car.state(i);
      if (item.state === "hidden" || item.state === "gone") continue;
      const tw = tweets[i]!;
      const { transform, opacity, extra } = slideTransform(item.state, item.enter, item.exit);

      // The hook reads as a cover; the numbered posts read as body. Same font,
      // two ranks — that hierarchy is what stops a thread looking like slides.
      const isHook = i === 0;
      const bodySize = Math.round(Math.min(heroFontSize(tw.text.length), isHook ? 108 : 80) * s);
      const statsHtml = tw.stats
        ? `<div style="${std.css({ marginTop: 40 * s })}">${metricsRow(
            tw.stats,
            { replies: tw.stats.replies ?? 0, reposts: tw.stats.reposts ?? 0, likes: tw.stats.likes ?? 0, views: tw.stats.views ?? 0 },
            "full",
            tk,
            std,
            { iconSize: Math.round(26 * s), fontSize: Math.round(26 * s), gap: Math.round(44 * s) },
          )}</div>`
        : "";
      const mediaHtml = tw.media?.length
        ? `<div style="${std.css({ marginTop: 40 * s, maxWidth: Math.min(colWidth, 1240 * s) })}">${mediaGrid(tw.media, tk, std, { maxHeight: Math.round(340 * s) })}</div>`
        : "";
      const counterHtml =
        position === "counter"
          ? `<div style="${std.css({
              position: "absolute",
              top: 0,
              right: 0,
              fontSize: 24 * s,
              fontWeight: 700,
              color: tk.accent,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.04em",
            })}">${i + 1} / ${est.count}</div>`
          : "";

      slidesHtml += `<div style="${std.css({
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        zIndex: item.state === "entering" ? 2 : 1,
        opacity,
      })}; transform:${transform || "none"}; ${extra}">
        ${counterHtml}
        <div style="${std.css({
          fontSize: bodySize,
          fontWeight: isHook ? 800 : 600,
          lineHeight: isHook ? 1.06 : 1.2,
          letterSpacing: isHook ? "-0.035em" : "-0.018em",
          color: tk.text,
          maxWidth: isHook ? Math.round(colWidth * 0.92) : colWidth,
        })}">${linkify(tw.text, tk.accent, std)}</div>
        ${mediaHtml}
        ${statsHtml}
      </div>`;
    }

    // ---- summary end-card (the payoff beat) ----
    let summaryHtml = "";
    if (est.hasCount && t.in("count") > 0) {
      const shown = Math.max(
        1,
        Math.floor(t.tween(0, est.count, { id: "count.roll", during: "count", at: "0s", for: "0.5s", easing: "easeOutBack" })),
      );
      const numberIn = t.motion({ id: "count.number", during: "count", at: "0s", for: "0.45s", scale: 0.92, easing: "easeOutCubic" });
      const caption = t.motion({ id: "count.caption", during: "count", at: "0.15s", for: "0.4s", y: 12, easing: "easeOutCubic" });
      summaryHtml = `<div style="${std.css({
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        zIndex: 3,
      })}">
        <div style="${std.css({
          fontSize: 220 * s,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: tk.text,
          fontVariantNumeric: "tabular-nums",
        })}; ${numberIn.style}">${shown}</div>
        <div style="${std.css({ width: 120 * s, height: 6, borderRadius: 3, background: tk.accent, marginTop: 26 * s })}; ${caption.style}"></div>
        <div style="${std.css({ fontSize: 32 * s, fontWeight: 600, letterSpacing: "-0.01em", color: tk.muted, marginTop: 24 * s })}; ${caption.style}">posts in this thread by @${std.text.escapeHtml(stripAt(author.handle))}</div>
        ${brand ? `<div style="${std.css({ display: "flex", justifyContent: "center", marginTop: 36 * s })}; ${caption.style}">${brandWatermark(brand, tk, std, Math.round(24 * s))}</div>` : ""}
      </div>`;
    }
    // Held last slide crossfades out under the incoming summary (no pop-out).
    const slidesFade =
      est.hasCount && t.in("count") > 0
        ? 1 - std.interpolate(t.in("count"), [0, 0.3], [0, 1], "easeInCubic")
        : 1;

    // ---- outro: exits accelerate out ----
    const globalOpacity = 1 - std.interpolate(t.in("outro"), [0, 1], [0, 1], "easeInCubic");

    return Html({ id: "post-thread", width: "fill", height: "fill", html: `<div style="${std.css({
      width,
      height,
      background: canvasBackground(tk, std, 0),
      position: "relative",
      overflow: "hidden",
      opacity: globalOpacity,
    })}">
      <div style="${std.css({ opacity: ghostOpacity })}">${ghostGlyph(tk, Math.round(Math.max(width, height) * 1.05))}</div>
      <div style="${std.css({
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        paddingTop: isPortrait ? height * 0.14 : 90 * s,
        paddingBottom: isPortrait ? height * 0.2 : 90 * s,
        paddingLeft: marginX,
        paddingRight: marginX,
      })}">
        ${headerHtml}
        ${railHtml}
        <div style="${std.css({ flex: 1, position: "relative", minHeight: 0, marginTop: 20 * s })}">
          ${slidesFade > 0 ? `<div style="${std.css({ position: "absolute", inset: 0, opacity: slidesFade })}">${slidesHtml}</div>` : ""}
          ${summaryHtml}
        </div>
      </div>
    </div>` });
  },
});
