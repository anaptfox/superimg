// Demonstrates: A dynamic watermark that behaves like an HTML overlay in the browser and an image in the final MP4.

import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Hello, SuperImg!",
    subtitle: "Create stunning videos from code",
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
    watermark: {
      type: "text",
      content: "Made with SuperImg",
      href: "https://github.com/superimg/superimg",
      position: "bottom-right",
      opacity: 0.8,
      style: {
        "color": "white",
        "font-family": "Space Grotesk, sans-serif",
        "font-weight": "700",
        "font-size": "24px",
        "background": "rgba(0, 0, 0, 0.5)",
        "padding": "8px 16px",
        "border-radius": "8px",
        "text-decoration": "none"
      }
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

    // Timeline: 1.5s Enter | 1.5s Hold | 1.0s Exit (on a 4s duration)
    const t = std.score({ enter: 0.375, hold: 0.375, exit: 0.25 });

    const lineAnim     = t.motion({ at: 0,    duration: 0.8,  easing: "easeOutCubic" });
    const titleAnim    = t.motion({ at: 0.15, duration: 0.85, y: 40, easing: "easeOutCubic" });
    const subtitleAnim = t.motion({ at: 0.3,  duration: 0.85, y: 30, easing: "easeOutCubic" });

    // Responsive sizing
    const titleSize = isPortrait ? 64 : 88;
    const subtitleSize = isPortrait ? 22 : 28;
    const lineMaxWidth = isPortrait ? 350 : 500;

    const bodyStyle = std.css({ width, height, position: "relative" }, std.css.center());
    const lineStyle = std.css({
      width: lineAnim.enter * 100 + "%",
      maxWidth: lineMaxWidth,
      background: std.color.alpha(accentColor, 0.8 * lineAnim.opacity)
    });

    return `
      <div style="${bodyStyle}">
        <div class="container">
          <div class="accent-line" style="${lineStyle}"></div>
          <h1 class="title" style="${std.css({ fontSize: titleSize, color: accentColor })}; ${titleAnim.style}">
            ${title}
          </h1>
          <p class="subtitle" style="${std.css({ fontSize: subtitleSize })}; ${subtitleAnim.style}">
            ${subtitle}
          </p>
          <div class="accent-line" style="${lineStyle}"></div>
        </div>
      </div>
    `;
  },
});
