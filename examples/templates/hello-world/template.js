// Hello World Example — Animated Title Card
// Demonstrates: easing, math, color utilities, and defaults-driven data from ctx.data
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
    const easedEnter = std.easing.easeOutCubic(enterProgress);

    // Title animation
    const titleOpacity = std.math.lerp(0, 1, easedEnter) * (1 - exitProgress);
    const titleY = std.math.lerp(40, 0, easedEnter);

    // Subtitle animation (staggered +0.3s)
    const subtitleEnter = std.math.clamp((time - 0.3) / 1.5, 0, 1);
    const easedSubtitle = std.easing.easeOutCubic(subtitleEnter);
    const subtitleOpacity = std.math.lerp(0, 0.8, easedSubtitle) * (1 - exitProgress);
    const subtitleY = std.math.lerp(30, 0, easedSubtitle);

    // Accent lines (draw from center, staggered +0.5s)
    const lineEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);
    const lineWidth = std.easing.easeOutCubic(lineEnter) * 100 * (1 - exitProgress);
    const lineColor = std.color.alpha(accentColor, 0.8 * (1 - exitProgress));

    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${width}px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f0f23;
          font-family: 'Space Grotesk', sans-serif;
          overflow: hidden;
          position: relative;
        }
        .container {
          text-align: center;
          position: relative;
          z-index: 1;
        }
        .accent-line {
          width: ${lineWidth}%;
          max-width: ${lineMaxWidth}px;
          height: 2px;
          background: ${lineColor};
          margin: 0 auto;
        }
        .title {
          font-size: ${titleSize}px;
          font-weight: 700;
          margin: 24px 0 12px;
          color: ${accentColor};
          opacity: ${titleOpacity};
          transform: translateY(${titleY}px);
        }
        .subtitle {
          font-family: 'Inter', sans-serif;
          font-size: ${subtitleSize}px;
          font-weight: 500;
          color: white;
          opacity: ${subtitleOpacity};
          transform: translateY(${subtitleY}px);
          margin-bottom: 24px;
        }
      </style>
      <div class="container">
        <div class="accent-line"></div>
        <h1 class="title">${title}</h1>
        <p class="subtitle">${subtitle}</p>
        <div class="accent-line"></div>
      </div>
    `;
  },
});
