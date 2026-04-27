import { defineScene } from "superimg";

export default defineScene({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "2s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .cta { font-size: 64px; font-weight: 700; }
    `],
  },
  data: { cta: "Thanks for watching!" },
  render(ctx) {
    const opacity = ctx.std.interpolate(ctx.sceneProgress * 2, [0, 1], [0, 1], "easeOutCubic");
    return `
      <div style="${ctx.std.css.fill()};${ctx.std.css.center()};
        background: linear-gradient(135deg, #059669 0%, #0891b2 100%);">
        <h1 class="cta" style="opacity: ${opacity}">${ctx.data.cta}</h1>
      </div>
    `;
  },
});
