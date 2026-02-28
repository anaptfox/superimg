import { defineTemplate } from "superimg";

export default defineTemplate({
  config: {
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw; height: 100vh;
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        color: white; overflow: hidden;
      }
      .content { text-align: center; }
      .title {
        font-size: 96px; font-weight: 700; margin-bottom: 24px;
        text-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .subtitle { font-size: 32px; font-weight: 400; opacity: 0.8; }
    `],
  },
  defaults: {
    title: "Welcome",
    subtitle: undefined as string | undefined,
    accentColor: "#667eea",
  },
  render(ctx) {
    const { std, sceneProgress, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const opacity = std.tween(0, 1, sceneProgress, "easeOutCubic");
    const scale = std.tween(0.8, 1, sceneProgress, "easeOutCubic");

    const contentStyle = std.css({ opacity, transform: "scale(" + scale + ")" });
    const titleBg = std.css({ background: "linear-gradient(135deg, " + accentColor + " 0%, white 100%)" });

    return `
    <div style="${std.css.fill()};${std.css.center()}">
      <div class="content" style="${contentStyle}">
        <h1 class="title" style="${titleBg}">${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
      </div>
    </div>
  `;
  },
});
