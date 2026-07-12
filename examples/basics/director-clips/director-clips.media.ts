import { define } from "superimg";

export default define({
  sample: {
    hook: "Ship faster.",
    demo: "Director clips, not timelines.",
    cta: "superimg.dev",
    accent: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [
      "* { margin: 0; box-sizing: border-box; }",
      "body { background: #0f0f23; font-family: Inter, system-ui; color: #fff; overflow: hidden; }",
    ],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ hook: "2s", demo: "3s", outro: "1s" });

    const hook = t.clip({ during: "hook" });
    if (hook.active) {
      const local = hook.director();
      const card = local.motion({ y: 32, scale: 0.92 });
      return `
        <div style="${std.css({ width, height }, std.css.center())}">
          <h1 style="${std.css({ fontSize: 96, color: data.accent }, card.style)}">${data.hook}</h1>
        </div>
      `;
    }

    const demo = t.clip({ during: "demo" });
    const feature = demo.clip({ from: "0.5s", duration: "1.5s" });
    if (demo.active) {
      const local = demo.director();
      const title = local.motion({ y: 24 });
      // Smooth emphasis: dim → full over the first 25% of the feature clip.
      // (feature.progress is clamped, so the text stays emphasized afterwards
      // instead of flashing to opacity 0 when the nested clip re-enters.)
      const emphasis = std.interpolate(feature.progress, [0, 0.25], [0, 1], "easeOutCubic");
      const highlight = `opacity:${(0.6 + 0.4 * emphasis).toFixed(3)}`;
      return `
        <div style="${std.css({ width, height }, std.css.center(), std.css.column())}">
          <p style="${std.css({ fontSize: 28, opacity: 0.5, marginBottom: 16 }, title.style)}">Demo</p>
          <h2 style="${std.css({ fontSize: 72, maxWidth: 900, textAlign: "center" }, title.style, highlight)}">${data.demo}</h2>
        </div>
      `;
    }

    const outro = t.clip({ during: "outro" });
    if (outro.active) {
      const local = outro.director();
      const cta = local.motion({ y: 20 });
      return `
        <div style="${std.css({ width, height }, std.css.center())}">
          <span style="${std.css({ fontSize: 48, letterSpacing: "0.08em", color: data.accent }, cta.style)}">${data.cta}</span>
        </div>
      `;
    }

    return `<div style="${std.css({ width, height, background: "#0f0f23" })}"></div>`;
  },
});