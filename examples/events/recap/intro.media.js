import { define } from "superimg";

export default define({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "2s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .title { font-size: 96px; font-weight: 700; text-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    `],
  },
  sample: { title: "Welcome" },
  render(ctx) {
    const enter = ctx.std.interpolate(ctx.timeline.progress * 2, [0, 1], [0, 1], "easeOutCubic");
    const exitFade = ctx.std.interpolate(ctx.timeline.progress, [0.8, 1], [1, 0], "easeInCubic");
    const opacity = enter * exitFade;
    const scale = ctx.std.interpolate(ctx.timeline.progress * 2, [0, 1], [0.8, 1], "easeOutCubic");
    return `
      <div style="${ctx.std.css.fill()};${ctx.std.css.center()};
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h1 class="title" style="${ctx.std.css({ opacity, transform: "scale(" + scale + ")" })}">
          ${ctx.data.title}
        </h1>
      </div>
    `;
  },
});
