// Hello World Example — Animated Title Card
// Demonstrates: std.css(), inlineCss, tween, math, color utilities, and defaults-driven data
// Customize by passing data or editing the defaults!

import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "Hello, SuperImg!",
    subtitle: "Create stunning videos from code",
    accentColor: "#667eea",
  },

  config: {
    fps: 30,
    durationSeconds: 4,
    fonts: ["Space+Grotesk:wght@400;700", "Inter:wght@400;500"],
    outputs: {
      youtube: { width: 1920, height: 1080 },
      reels: { width: 1080, height: 1920 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0f0f23;
        font-family: 'Space Grotesk', sans-serif;
        overflow: hidden;
      }
      .container { text-align: center; position: relative; z-index: 1; }
      .accent-line { height: 2px; margin: 0 auto; }
      .title { font-weight: 700; margin: 24px 0 12px; }
      .subtitle {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        color: white;
        margin-bottom: 24px;
      }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, isPortrait, data } = ctx;
    const { title, subtitle, accentColor } = data;

    // Responsive sizing
    const titleSize = isPortrait ? 64 : 88;
    const subtitleSize = isPortrait ? 22 : 28;
    const lineMaxWidth = isPortrait ? 350 : 500;

    // Phase timing: Enter 0-1.5s | Hold 1.5-3s | Exit 3-4s
    const enterProgress = std.math.clamp(time / 1.5, 0, 1);
    const exitProgress = std.math.clamp((time - 3.0) / 1.0, 0, 1);
    const titleOpacity = std.tween(0, 1, enterProgress, "easeOutCubic") * (1 - exitProgress);
    const titleY = std.tween(40, 0, enterProgress, "easeOutCubic");

    // Subtitle animation (staggered +0.3s)
    const subtitleEnter = std.math.clamp((time - 0.3) / 1.5, 0, 1);
    const subtitleOpacity = std.tween(0, 0.8, subtitleEnter, "easeOutCubic") * (1 - exitProgress);
    const subtitleY = std.tween(30, 0, subtitleEnter, "easeOutCubic");

    // Accent lines (draw from center, staggered +0.5s)
    const lineEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);
    const lineWidth = std.tween(0, 100, lineEnter, "easeOutCubic") * (1 - exitProgress);
    const lineColor = std.color.alpha(accentColor, 0.8 * (1 - exitProgress));

    const bodyStyle = std.css({ width, height, position: "relative" }) + ";" + std.css.center();
    const lineStyle = std.css({ width: lineWidth + "%", maxWidth: lineMaxWidth, background: lineColor });
    const titleStyle = std.css({ fontSize: titleSize, color: accentColor, opacity: titleOpacity, transform: "translateY(" + titleY + "px)" });
    const subtitleStyle = std.css({ fontSize: subtitleSize, opacity: subtitleOpacity, transform: "translateY(" + subtitleY + "px)" });

    return `
      <div style="${bodyStyle}">
        <div class="container">
          <div class="accent-line" style="${lineStyle}"></div>
          <h1 class="title" style="${titleStyle}">${title}</h1>
          <p class="subtitle" style="${subtitleStyle}">${subtitle}</p>
          <div class="accent-line" style="${lineStyle}"></div>
        </div>
      </div>
    `;
  },
});
