import { define } from "superimg";

export default define({
  config: {
    fps: 30,
    duration: "4s",
    fonts: ["Inter:wght@500;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Inter, system-ui, sans-serif; color: #f8fafc; overflow: hidden; }
    `],
  },
  sample: {
    cta: "superimg.dev",
    tagline: "Layer the frame. Director the motion.",
    accent: "#34d399",
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ enter: "50%", hold: "35%", exit: "15%" });
    const card = t.motion({ scale: 0.92, opacity: 0, easing: "easeOutBack" });

    return `
      <div style="${std.css({ width, height, background: "#020617" }, std.css.center())}">
        <div style="${std.css({ textAlign: "center" }, card.style)}">
          <p style="font-size: 28px; color: #94a3b8; margin-bottom: 16px;">${data.tagline}</p>
          <p style="font-size: 56px; font-weight: 700; color: ${data.accent};">${data.cta}</p>
        </div>
      </div>
    `;
  },
});