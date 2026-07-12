import { define } from "superimg";

export const helloTemplate = define({
  sample: {
    title: "SuperImg",
    subtitle: "Vinxi React SPA",
    accentColor: "#667eea",
  },
  config: {
    fps: 30,
    duration: 4,
    fonts: ["Inter:wght@400;600;700"],
    inlineCss: [
      "* { margin: 0; padding: 0; box-sizing: border-box; }",
      "body { overflow: hidden; font-family: Inter, system-ui, sans-serif; background: #0a0a14; }",
    ],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ enter: "35%", hold: "45%", exit: "20%" });
    const title = t.motion({ during: "enter", at: "10%", for: "55%", y: 36, fromOpacity: 0 });
    const subtitle = t.motion({ during: "enter", at: "35%", for: "45%", y: 20, fromOpacity: 0 });

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden" })}">
        <div style="position:absolute; inset:0;
          background: radial-gradient(ellipse 700px 500px at 20% 30%, ${std.color.alpha(data.accentColor, 0.22)}, transparent 70%),
            linear-gradient(160deg, #06060c, #10101c 50%, #07070d);"></div>
        <div style="${std.css(std.css.center())}">
          <div style="text-align:center; padding:0 80px; ${title.style}">
            <h1 style="font-size:64px; font-weight:800; color:white; letter-spacing:-2px; margin-bottom:16px;">
              ${data.title}
            </h1>
            <p style="font-size:20px; color:rgba(255,255,255,0.55); letter-spacing:0.08em;
              text-transform:uppercase; ${subtitle.style}">
              ${data.subtitle}
            </p>
          </div>
        </div>
      </div>
    `;
  },
});

export const pulseTemplate = define({
  config: { fps: 24, duration: 2 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const scale = 0.82 + Math.sin(timeline.progress * Math.PI * 4) * 0.18;
    return `
      <div style="${std.css({ width, height, background: "#111827" }, std.css.center())}">
        <div style="width:96px; height:96px; border-radius:50%; background:#38bdf8;
          transform:scale(${scale}); box-shadow:0 0 48px rgba(56,189,248,0.55);"></div>
      </div>
    `;
  },
});

export const gradientTemplate = define({
  config: { fps: 24, duration: 2 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const hue = Math.floor(timeline.progress * 360);
    return `
      <div style="${std.css(
        {
          width,
          height,
          color: "white",
          fontSize: 28,
          fontWeight: 700,
          background: `linear-gradient(120deg, hsl(${hue}, 80%, 42%), #0f0f0f)`,
        },
        std.css.center(),
      )}">
        ${Math.floor(timeline.progress * 100)}%
      </div>
    `;
  },
});