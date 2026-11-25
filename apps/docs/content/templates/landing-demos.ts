import { define, type RenderContext } from "@foxworth/superimg";
import { Html } from "@foxworth/superimg";

/**
 * Homepage LiveExample — one media program, play + export in ~5s.
 * Works as reel (9:16) or landscape (16:9) via player format.
 */
export const landingDualPathTemplate = define({
  config: {
    fps: 30,
    duration: 5,
    // Default sample size; Player format overrides for reel vs landscape.
    width: 1080,
    height: 1920,
  },
  sample: {
    title: "Ship it",
    accent: "#818cf8",
  },
  render(ctx: RenderContext) {
    const { width, height, std, data } = ctx;
    const title = String(data.title ?? "Ship it");
    const accent = String(data.accent ?? "#818cf8");
    const portrait = height >= width;
    const scale = Math.min(width / (portrait ? 1080 : 1920), height / (portrait ? 1920 : 1080));
    const titleSize = Math.round((portrait ? 64 : 48) * Math.max(scale, 0.55));
    const bodySize = Math.round((portrait ? 18 : 15) * Math.max(scale, 0.55));
    const gap = Math.round((portrait ? 36 : 24) * Math.max(scale, 0.55));
    const padX = Math.round((portrait ? 36 : 40) * Math.max(scale, 0.55));
    const padY = Math.round((portrait ? 40 : 28) * Math.max(scale, 0.55));

    const t = ctx.director({ intro: "25%", live: "35%", export: "40%" });
    const card = t.motion({ y: 18, easing: "easeOutCubic" });
    const liveOp = Math.min(1, t.in("live") * 1.25);
    const exportOp = Math.min(1, t.in("export") * 1.25);

    const root = std.css({
      width,
      height,
      boxSizing: "border-box",
      margin: 0,
      padding: portrait ? `0 ${Math.round(width * 0.08)}px` : "0 24px",
      background: "linear-gradient(165deg, #0c0c12 0%, #16162a 48%, #12121c 100%)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      color: "#f4f4f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap,
    });

    const cardStyle = std.css(
      {
        opacity: t.in("intro"),
        padding: `${padY}px ${padX}px`,
        borderRadius: Math.round(16 * Math.max(scale, 0.7)),
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 0 0 1px rgba(0,0,0,0.2), 0 24px 48px rgba(0,0,0,0.35), 0 0 60px ${accent}22`,
        textAlign: "center",
        maxWidth: portrait ? width * 0.88 : 720,
        width: portrait ? "100%" : "auto",
        boxSizing: "border-box",
      },
      card.style,
    );

    const titleStyle = std.css({
      margin: 0,
      fontSize: titleSize,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
    });

    const chipStyle = std.css({
      marginTop: Math.round(14 * Math.max(scale, 0.55)),
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: bodySize,
      color: "rgba(244,244,245,0.55)",
      letterSpacing: "0.02em",
    });

    const pillsRow = std.css({
      display: "flex",
      flexDirection: portrait ? "column" : "row",
      gap: Math.round(12 * Math.max(scale, 0.55)),
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      width: portrait ? "100%" : "auto",
    });

    const pill = (opacity: number, filled: boolean) =>
      std.css({
        opacity,
        padding: `${Math.round(10 * Math.max(scale, 0.55))}px ${Math.round(18 * Math.max(scale, 0.55))}px`,
        borderRadius: 999,
        fontSize: bodySize,
        fontWeight: 600,
        letterSpacing: "0.02em",
        border: filled ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.14)",
        background: filled ? `${accent}28` : "rgba(255,255,255,0.05)",
        color: filled ? "#fff" : "rgba(244,244,245,0.85)",
        boxShadow: filled ? `0 0 24px ${accent}33` : "none",
        textAlign: "center",
        width: portrait ? "100%" : "auto",
        maxWidth: portrait ? 360 : "none",
        boxSizing: "border-box",
      });

    return Html({ width: "fill", height: "fill", html: `
      <div style="${root}">
        <div style="${cardStyle}">
          <h1 style="${titleStyle}">${escapeHtml(title)}</h1>
          <div style="${chipStyle}">render(ctx) · hello.media.ts</div>
        </div>
        <div style="${pillsRow}">
          <span style="${pill(liveOp, liveOp > 0.5)}">Live · in your app</span>
          <span style="${pill(exportOp, exportOp > 0.5)}">Export · MP4 · GIF · still</span>
        </div>
      </div>
    ` });
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** How it works — step 1: plain countdown */
export const howItWorksBeforeTemplate = define({
  config: {
    fps: 30,
    duration: 6,
    width: 360,
    height: 360,
  },
  render(ctx: RenderContext) {
    const { timeline, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(timeline.frame / fps));
    const bgStyle = std.css(
      {
        width,
        height,
        background: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
        fontFamily: "system-ui, sans-serif",
      },
      std.css.center(),
    );
    return Html({ width: "fill", height: "fill", html: `
      <div style="${bgStyle}">
        <div style="${std.css({ fontSize: 180, fontWeight: 800, color: "white", textShadow: "0 4px 20px rgba(0,0,0,0.5)" })}">
          ${count}
        </div>
      </div>
    ` });
  },
});

/** How it works — step 3: countdown with pulse + GO! */
export const howItWorksAfterTemplate = define({
  config: {
    fps: 30,
    duration: 6,
    width: 360,
    height: 360,
  },
  render(ctx: RenderContext) {
    const { timeline, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(timeline.frame / fps));
    const showGo = Math.floor(timeline.frame / fps) >= 5;
    const fraction = (timeline.frame % fps) / fps;
    const pulse = std.interpolate(fraction, [0, 1], [1.2, 1], "easeOutCubic");
    const glow = std.interpolate(fraction, [0, 1], [0.8, 0.2], "easeOutCubic");
    const bgStyle = std.css(
      {
        width,
        height,
        background: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
        fontFamily: "system-ui, sans-serif",
      },
      std.css.center(),
    );
    const numStyle = std.css({
      fontSize: 180,
      fontWeight: 800,
      color: "white",
      transform: `scale(${pulse})`,
      textShadow: `0 0 ${40 * glow}px rgba(102,126,234,${glow})`,
    });
    return Html({ width: "fill", height: "fill", html: `
      <div style="${bgStyle}">
        <div style="${numStyle}">${showGo ? "GO!" : count}</div>
      </div>
    ` });
  },
});
