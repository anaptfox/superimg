// Responsive Demo Example
// Demonstrates: isPortrait flag, responsive outputs, and layout adjustment

import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Responsive Design",
    subtitle: "One template, multiple formats",
    accentColor: "#667eea",
  },

  config: {
    fps: 30,
    duration: 4,
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
    const { std, width, height, isPortrait, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const t = std.score({ enter: 0.375, hold: 0.5, exit: 0.125 });
    const anim = t.motion({ y: 30 });

    // Responsive sizing
    const titleSize = isPortrait ? 64 : 88;
    const subtitleSize = isPortrait ? 22 : 28;
    const lineMaxWidth = isPortrait ? 350 : 500;

    const bodyStyle = std.css({ width, height, position: "relative" }, std.css.center());
    const lineStyle = std.css({
      width: anim.enter * 100 + "%",
      maxWidth: lineMaxWidth,
      background: std.color.alpha(accentColor, 0.8 * anim.opacity)
    });

    return `
      <div style="${bodyStyle}">
        <div class="container" style="${anim.style}">
          <div class="accent-line" style="${lineStyle}"></div>
          <h1 class="title" style="font-size: ${titleSize}px; color: ${accentColor};">${title}</h1>
          <p class="subtitle" style="font-size: ${subtitleSize}px;">${subtitle}</p>
          <div class="accent-line" style="${lineStyle}"></div>
        </div>
      </div>
    `;
  },
});
