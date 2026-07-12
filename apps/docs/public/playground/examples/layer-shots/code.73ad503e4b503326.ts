// Layer Shots — teaches the video composition model (template → layers → director)
// Demonstrates: std.layers(), ctx.director(), std.reveal.wipe(), motion on overlay + inline

import { define } from "superimg";
import { lowerThirdOverlay } from "./shots";

export default define({
  sample: {
    headline: "Layer the frame",
    tagline: "Director the motion",
    speaker: "Alex Chen",
    role: "Design Systems",
    accentColor: "#667eea",
    backgroundImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "8s",
    fonts: ["Inter:wght@400;600;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
      .headline { font-weight: 700; color: #fff; letter-spacing: -0.02em; }
      .tagline { font-weight: 400; color: rgba(255,255,255,0.75); margin-top: 12px; }
      .lower-third { display: flex; align-items: stretch; }
      .accent-bar { flex-shrink: 0; }
      .name-text { color: #fff; font-weight: 700; white-space: nowrap; }
      .role-text { color: rgba(255,255,255,0.85); font-weight: 400; white-space: nowrap; }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { headline, tagline, speaker, role, accentColor, backgroundImage } = data;

    // Tier 3 — Director: phase clock + motion output
    const t = ctx.director({ intro: "1.5s", hold: "5s", exit: "1.5s" });

    const wipe = std.reveal.wipe({
      progress: t.in("intro", { duration: "70%"}),
      direction: "diagonal",
      color: accentColor,
    });
    // duration: 0.7 = first 70% of intro phase

    const bg = std.backgrounds.kenBurns({
      src: backgroundImage,
      progress: t.progress,
      overlay: "rgba(0,0,0,0.45)",
    });

    // Pattern A: motion.style inline in content HTML
    const headlineMotion = t.motion({ during: "intro", at: "20%", y: 32 });
    const taglineMotion = t.motion({ during: "intro", at: "35%", y: 20 });

    const contentHtml = `
      <div style="${std.css({ textAlign: "center" })}">
        <div class="headline" style="${std.css({ fontSize: 72 })}; ${headlineMotion.style}">${headline}</div>
        <div class="tagline" style="${std.css({ fontSize: 28 })}; ${taglineMotion.style}">${tagline}</div>
      </div>
    `;

    // Pattern B: motion on L.overlay via helper
    const lowerThirdMotion = t.motion({ during: "intro", at: "50%", y: 40 });
    const lowerThirdHtml = `
      <div class="lower-third">
        <div class="accent-bar" style="${std.css({ width: 4, background: accentColor })}"></div>
        <div style="${std.css({ background: std.color.alpha("#000", 0.8), padding: "12px 20px" }, std.css.column())}">
          <div class="name-text" style="${std.css({ fontSize: 28 })}">${speaker}</div>
          <div class="role-text" style="${std.css({ fontSize: 18, marginTop: 4 })}">${role}</div>
        </div>
      </div>
    `;

    // Tier 2 — Layers: shot stack (z-order by declaration)
    const L = std.layers({ width, height, mode: "opaque" });

    return L.render(
      L.bg(bg.html),
      L.tint("rgba(0,0,0,0.15)"),
      L.content(contentHtml, { safe: "broadcast" }),
      lowerThirdOverlay(L, lowerThirdHtml, { motion: lowerThirdMotion, offset: { y: 80 } }),
      L.fx(wipe.html, { visible: () => wipe.active }),
    );
  },
});