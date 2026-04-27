// Hello World Example — Animated Title Card
// Demonstrates: std.score, gradients, and cinematic animation logic

import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Hello, SuperImg!",
    subtitle: "STUNNING VIDEOS FROM CODE",
    accentColor: "#667eea",
  },

  config: {
    fps: 30,
    duration: 4,
    fonts: ["Space+Grotesk:wght@400;700", "Inter:wght@400;500;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0f0f23;
        font-family: 'Space Grotesk', sans-serif;
        overflow: hidden;
      }
      .container { text-align: center; position: relative; z-index: 1; }
      .accent-line { height: 2px; margin: 0 auto; }
      .title { 
        font-weight: 700; 
        margin: 20px 0 8px; 
        letter-spacing: -0.03em;
        text-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      .subtitle {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.6);
        letter-spacing: 0.15em;
        margin-bottom: 20px;
      }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    // Timeline: 1.5s Enter | 2s Hold | 0.5s Exit
    const t = std.score({ enter: 0.375, hold: 0.5, exit: 0.125 });

    // Animations with more overlapping/organic timings
    const lineAnim     = t.motion({ at: 0.05, duration: 0.7, easing: "easeOutCubic" });
    const titleAnim    = t.motion({ at: 0.1,  duration: 0.8, y: 40, scale: 0.96, easing: "easeOutCubic" });
    const subtitleAnim = t.motion({ at: 0.25, duration: 0.7, y: 20, easing: "easeOutCubic" });

    // Cinematic "Camera" Scale: slowly zooms in over the entire scene
    const cameraScale = std.interpolate(t.progress, [0, 1], [1, 1.04]);

    // Dynamic Background: Radial gradient that shifts slightly
    const bgPos = 50 + (t.progress * 10);
    const bgStyle = std.css({
      width, height,
      background: `radial-gradient(circle at 50% ${bgPos}%, #1a1a3a 0%, #0f0f23 100%)`,
    }, std.css.center());

    // Glowing Gradient Lines
    const lineStyle = std.css({
      width: lineAnim.enter * 100 + "%",
      maxWidth: 500,
      background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
      opacity: 0.8 * lineAnim.opacity
    });

    return `
      <div style="${bgStyle}">
        <div class="container" style="transform: scale(${cameraScale})">
          <div class="accent-line" style="${lineStyle}"></div>
          
          <h1 class="title" style="${std.css({ fontSize: 88, color: "white" })}; ${titleAnim.style}">
            ${title}
          </h1>
          
          <p class="subtitle" style="${std.css({ fontSize: 18 })}; ${subtitleAnim.style}">
            ${subtitle}
          </p>
          
          <div class="accent-line" style="${lineStyle}"></div>
        </div>
      </div>
    `;
  },
});
