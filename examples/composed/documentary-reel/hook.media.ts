import { define } from "superimg";

export default define({
  config: {
    fps: 30,
    duration: "6s",
    fonts: ["Inter:wght@400;600;800"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Inter, system-ui, sans-serif; color: #f8fafc; overflow: hidden; }
    `],
  },
  sample: {
    hook: "What if your video editor",
    hookAccent: "was just a config file?",
    accent: "#38bdf8",
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ enter: "40%", hold: "45%", exit: "15%" });
    const line1 = t.motion({ at: "0.2s", for: "0.6s", y: 28, easing: "easeOutCubic" });
    const line2 = t.motion({ at: "0.3s", for: "0.6s", y: 36, easing: "easeOutCubic" });

    return `
      <div style="${std.css({ width, height, background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1e293b 0%, #020617 70%)" }, std.css.center())}">
        <div style="text-align: center; max-width: 80%;">
          <p style="${std.css({ fontSize: 52, fontWeight: 600, lineHeight: 1.2, marginBottom: 16 }, line1.style)}">${data.hook}</p>
          <p style="${std.css({ fontSize: 64, fontWeight: 800, lineHeight: 1.1, color: data.accent }, line2.style)}">${data.hookAccent}</p>
        </div>
      </div>
    `;
  },
});