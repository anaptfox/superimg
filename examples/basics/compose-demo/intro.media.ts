import { define } from "superimg";

export default define({
  config: {
    fps: 30,
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
  sample: { title: "Welcome", accentColor: "#667eea" },
  render(ctx) {
    const { std, data } = ctx;
    const t = ctx.director({ enter: "75%", hold: "15%", exit: "10%" });
    const card = t.motion({ during: "enter", y: 24, scale: 0.9, easing: "easeOutCubic" });

    return `
      <div style="${std.css(std.css.fill(), std.css.center())}">
        <div style="${card.style}">
          <h1 class="title" style="background: linear-gradient(135deg, ${data.accentColor} 0%, white 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;">${data.title}</h1>
        </div>
      </div>
    `;
  },
});