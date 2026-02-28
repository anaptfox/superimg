// Phase Demo — Render-Carrying Phases
// Demonstrates: std.timing.sequence() with render functions
// Each phase owns its own visual logic, no conditional trees needed.

import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    message: "Hello, Phases!",
    accentColor: "#8b5cf6",
  },

  config: {
    fps: 30,
    durationSeconds: 4,
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
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { message, accentColor } = data;

    // Each phase owns its render logic
    const phases = std.timing.sequence({
      enter: {
        duration: 0.8,
        render: (p) => {
          const scale = std.tween(0.8, 1, p, "easeOutBack");
          const opacity = std.tween(0, 1, p, "easeOutCubic");
          return card({ scale, opacity, y: 0 });
        },
      },
      hold: {
        duration: 2.4,
        render: () => card({ scale: 1, opacity: 1, y: 0 }),
      },
      exit: {
        duration: 0.8,
        render: (p) => {
          const y = std.tween(0, -60, p, "easeInCubic");
          const opacity = std.tween(1, 0, p, "easeInCubic");
          return card({ scale: 1, opacity, y });
        },
      },
    });

    // Helper renders the card with given animation state
    function card({ scale, opacity, y }) {
      const style = std.css({
        fontSize: 64,
        fontWeight: 600,
        color: accentColor,
        padding: "48px 80px",
        background: "rgba(255, 255, 255, 0.05)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        transform: `scale(${scale}) translateY(${y}px)`,
        opacity,
      });
      return `<div style="${style}">${message}</div>`;
    }

    const wrapperStyle = std.css({ width, height }) + ";" + std.css.center();

    return `<div style="${wrapperStyle}">${phases.render(time)}</div>`;
  },
});
