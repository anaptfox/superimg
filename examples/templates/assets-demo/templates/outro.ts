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
      .cta {
        font-size: 64px; font-weight: 700; margin-bottom: 32px;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      }
      .url {
        font-size: 24px; padding: 16px 48px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px; backdrop-filter: blur(8px);
      }
    `],
  },
  defaults: {
    cta: "Thanks for watching!",
    url: undefined as string | undefined,
    fadeOut: true,
  },
  render(ctx) {
    const { std, sceneProgress, data } = ctx;
    const { cta, url, fadeOut } = data;

    const fadeInProgress = std.math.clamp(sceneProgress * 4, 0, 1);
    const fadeOutProgress = fadeOut ? std.math.clamp((sceneProgress - 0.7) * 3.33, 0, 1) : 0;
    const opacity = std.tween(0, 1, fadeInProgress, "easeOutCubic")
      * (1 - std.tween(0, 1, fadeOutProgress, "easeInCubic"));
    const pulse = 1 + Math.sin(sceneProgress * Math.PI * 4) * 0.02;

    const contentStyle = std.css({ opacity });
    const ctaStyle = std.css({ transform: "scale(" + pulse + ")" });

    return `
    <div style="${std.css.fill()};${std.css.stack()};${std.css.center()}">
      <div class="content" style="${contentStyle}">
        <h1 class="cta" style="${ctaStyle}">${cta}</h1>
        ${url ? `<div class="url">${url}</div>` : ""}
      </div>
    </div>
  `;
  },
});
