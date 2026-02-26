import { defineTemplate } from "superimg";

export default defineTemplate({
  config: {
    fonts: ["IBM+Plex+Sans:wght@400;700"],
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
    const opacity = std.easing.easeOutCubic(fadeInProgress) * (1 - std.easing.easeInCubic(fadeOutProgress));
    const pulse = 1 + Math.sin(sceneProgress * Math.PI * 4) * 0.02;

    return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        color: white;
        overflow: hidden;
      }
      .content {
        text-align: center;
        opacity: ${opacity};
      }
      .cta {
        font-size: 64px;
        font-weight: 700;
        margin-bottom: 32px;
        transform: scale(${pulse});
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      }
      .url {
        font-size: 24px;
        padding: 16px 48px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        backdrop-filter: blur(8px);
      }
    </style>
    <div class="content">
      <h1 class="cta">${cta}</h1>
      ${url ? `<div class="url">${url}</div>` : ""}
    </div>
  `;
  },
});
