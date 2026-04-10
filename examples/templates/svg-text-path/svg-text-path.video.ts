// SVG Text Path — Curved Text Demo
// Demonstrates: std.svg.textPath() + std.svg.shape.wave() for text on curves

import { defineScene } from "superimg";

export default defineScene({
  data: {
    line1: "SUPERIMG — PROGRAMMATIC VIDEO —",
    line2: "HTML TO MP4 — CREATE STUNNING VIDEOS —",
    accentColor: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    fonts: ["Space+Grotesk:wght@700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { line1, line2, accentColor } = data;

    // Breathing wave amplitude
    const breathe = 1 + Math.sin(sceneProgress * Math.PI * 2) * 0.2;
    const amp1 = 60 * breathe;
    const amp2 = 45 * breathe;

    // Two wave paths at different heights
    const wave1 = std.svg.shape.wave(width * 2, 200, amp1, 2, 0);
    const wave2 = std.svg.shape.wave(width * 2, 200, amp2, 2.5, Math.PI * 0.5);

    // Text scrolls along the wave
    const offset1 = std.tween(-10, 60, sceneProgress, "linear");
    const offset2 = std.tween(70, 10, sceneProgress, "linear");

    // Fade in/out
    const opacity = std.interpolate(sceneProgress, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);

    const text1 = std.svg.textPath(line1, wave1, {
      offset: offset1,
      fontSize: 64,
      fill: accentColor,
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: "700",
      letterSpacing: "8px",
      id: "wave1",
    });

    const text2 = std.svg.textPath(line2, wave2, {
      offset: offset2,
      fontSize: 48,
      fill: std.color.alpha(accentColor, 0.5),
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: "700",
      letterSpacing: "6px",
      id: "wave2",
    });

    // Subtle glow lines along the wave paths
    const glowOpacity = 0.15 + Math.sin(sceneProgress * Math.PI * 3) * 0.1;

    return `
      <div style="width:${width}px;height:${height}px;opacity:${opacity};${std.css.center()}">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- Wave path visualizations (subtle) -->
          <g transform="translate(0, ${height * 0.3})">
            <path d="${wave1}" fill="none" stroke="${std.color.alpha(accentColor, glowOpacity)}"
                  stroke-width="1" />
            ${text1}
          </g>

          <g transform="translate(0, ${height * 0.55})">
            <path d="${wave2}" fill="none" stroke="${std.color.alpha(accentColor, glowOpacity * 0.5)}"
                  stroke-width="1" />
            ${text2}
          </g>
        </svg>
      </div>
    `;
  },
});
