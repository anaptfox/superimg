/**
 * Clip Reel — nested director.clip() + std.video.sync
 *
 * Phases drive the overall story; each reel segment is a nested clip with its
 * own local director and a frame-synced embedded video.
 */

import { define } from "superimg";

const SEGMENTS = [
  { from: "0s", duration: "2s", label: "Countdown", asset: "countdown" as const },
  { from: "2s", duration: "2s", label: "Stats Card", asset: "stats" as const },
  { from: "4s", duration: "2s", label: "Lower Thirds", asset: "lowerThirds" as const },
] as const;

export default define({
  sample: {
    title: "Clip Reel",
    subtitle: "Nested clips · synced video",
    accent: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "9s",
    fonts: ["Inter:wght@400;600;700"],
    assets: {
      countdown: "../../marketing/countdown/output.mp4",
      stats: "../../data/stats-card/output.mp4",
      lowerThirds: "../../marketing/lower-thirds/output.mp4",
    },
    inlineCss: [
      "* { margin: 0; box-sizing: border-box; }",
      "body { background: #0a0a12; font-family: Inter, system-ui; color: #fff; overflow: hidden; }",
    ],
  },

  render(ctx) {
    const { std, width, height, data, assets } = ctx;
    const t = ctx.director({ intro: "1.5s", reel: "6s", outro: "1.5s" });

    const intro = t.clip({ during: "intro" });
    if (intro.active) {
      const local = intro.director({ enter: "40%", hold: "40%", exit: "20%" });
      const title = local.motion({ y: 28, scale: 0.94 });
      const subtitle = local.motion({ y: 16, at: "20%"});
      return `
        <div style="${std.css({ width, height }, std.css.center(), std.css.column())}">
          <h1 style="${std.css({ fontSize: 88, fontWeight: 700, color: data.accent }, title.style)}">${data.title}</h1>
          <p style="${std.css({ fontSize: 28, opacity: 0.65, marginTop: 12 }, subtitle.style)}">${data.subtitle}</p>
        </div>
      `;
    }

    const reel = t.clip({ during: "reel" });
    if (reel.active) {
      const active = SEGMENTS.find((seg) => reel.clip({ from: seg.from, duration: seg.duration }).active);
      if (active) {
        const clip = reel.clip({ from: active.from, duration: active.duration });
        const local = clip.director({ enter: "20%", hold: "60%", exit: "20%" });
        const meta = assets[active.asset];
        const video = std.video.sync({
          src: meta?.url ?? "",
          at: clip.seconds,
          width: 960,
          height: 540,
          objectFit: "cover",
        });
        const label = local.motion({ y: 20 });
        const badge = local.motion({ scale: 0.9, at: "15%"});
        const idx = SEGMENTS.indexOf(active) + 1;

        return `
          <div style="${std.css({ width, height }, std.css.center())}">
            <div style="${std.css({ position: "relative" })}">
              <div style="${std.css({ borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }, badge.style)}">
                ${video.html}
              </div>
              <div style="${std.css({
                position: "absolute",
                top: 16,
                left: 16,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.55)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              })}">
                ${idx} / ${SEGMENTS.length}
              </div>
            </div>
            <div style="${std.css({ marginTop: 28, textAlign: "center" }, label.style)}">
              <div style="${std.css({ fontSize: 36, fontWeight: 600 })}">${active.label}</div>
              <div style="${std.css({ fontSize: 18, opacity: 0.5, marginTop: 8 })}">
                clip ${clip.seconds.toFixed(2)}s · source ${video.time.toFixed(2)}s
              </div>
            </div>
          </div>
        `;
      }
    }

    const outro = t.clip({ during: "outro" });
    if (outro.active) {
      const local = outro.director();
      const cta = local.motion({ y: 24 });
      return `
        <div style="${std.css({ width, height }, std.css.center(), std.css.column())}">
          <span style="${std.css({ fontSize: 52, fontWeight: 700, color: data.accent }, cta.style)}">director.clip + video.sync</span>
          <span style="${std.css({ fontSize: 22, opacity: 0.55, marginTop: 12 }, cta.style)}">superimg.dev</span>
        </div>
      `;
    }

    return `<div style="${std.css({ width, height, background: "#0a0a12" })}"></div>`;
  },
});