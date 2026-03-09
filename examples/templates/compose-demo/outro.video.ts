import { defineScene } from "superimg";

export default defineScene({
  config: {
    duration: "2s",
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 100vw; height: 100vh; font-family: 'IBM Plex Sans', sans-serif;
        color: white; overflow: hidden; }
      .content { text-align: center; }
      .cta { font-size: 64px; font-weight: 700; }
    `],
  },
  defaults: { cta: "Thanks for watching!" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return `
      <div style="${ctx.std.css.fill()};${ctx.std.css.center()}">
        <h1 class="cta" style="${ctx.std.css({ opacity })}">${ctx.data.cta}</h1>
      </div>
    `;
  },
});
