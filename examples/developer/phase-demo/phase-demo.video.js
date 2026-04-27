// Phase Demo — Score API
// Demonstrates: std.score() for declarative phase-based layouts.
// Replaces the legacy timeline() approach with automatic enter/exit motion.

import { defineScene } from "superimg";

export default defineScene({
  data: {
    message: "Hello, Phases!",
    accentColor: "#8b5cf6",
  },

  config: {
    fps: 30,
    duration: 4,
    fonts: ["Inter:wght@600"],
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0f172a;
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
    `],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { message, accentColor } = data;

    // score: enter (20%) → hold (60%) → exit (20%)
    // Total duration is 4s, so 0.8s / 2.4s / 0.8s.
    const t = std.score({ enter: 0.2, hold: 0.6, exit: 0.2 });

    // Declare the card motion with enter and exit behaviors
    const cardAnim = t.motion({
      scale: 0.8,
      easing: "easeOutBack",
      exit: {
        y: -60,
        easing: "easeInCubic"
      }
    });

    const cardStyle = std.css({
      fontSize: 64,
      fontWeight: 600,
      color: accentColor,
      padding: "48px 80px",
      background: "rgba(255, 255, 255, 0.05)",
      borderRadius: 24,
      border: "1px solid rgba(255, 255, 255, 0.1)",
    });

    // Determine current phase and render accordingly
    const wrapperStyle = std.css({ width, height }, std.css.center());

    return `
      <div style="${wrapperStyle}">
        <div style="${cardStyle}; ${cardAnim.style}">
          ${message}
        </div>
      </div>
    `;
  },
});
