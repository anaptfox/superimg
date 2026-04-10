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
      .title { font-size: 96px; font-weight: 700; text-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    `],
  },
  data: { title: "Welcome", accentColor: "#667eea" },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress, "easeOutCubic");
    const scale = ctx.std.tween(0.8, 1, ctx.sceneProgress, "easeOutCubic");
    return `
      <div style="${ctx.std.css(ctx.std.css.fill(), ctx.std.css.center())}">
        <div style="${ctx.std.css({ opacity, transform: "scale(" + scale + ")" })}">
          <h1 class="title" style="background: linear-gradient(135deg, ${ctx.data.accentColor} 0%, white 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;">${ctx.data.title}</h1>
        </div>
      </div>
    `;
  },
});
