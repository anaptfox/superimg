// Phase Demo — Timeline API
// Demonstrates: timeline() with scoped phases
// Each phase has its own progress, cleanly separated.

import { defineScene } from "superimg";
import { timeline } from "@superimg/stdlib/timeline";

export default defineScene({
  defaults: {
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
    const { std, sceneTimeSeconds: time, sceneDurationSeconds: duration, width, height, data } = ctx;
    const { message, accentColor } = data;

    // Timeline: enter (0.8s) → hold (2.4s) → exit (0.8s)
    const tl = timeline(time, duration);
    const enter = tl.at("enter", 0, 0.8);
    const hold = tl.at("hold", 0.8, 2.4);
    const exit = tl.at("exit", 3.2, 0.8);

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

    // Determine current phase and render accordingly
    let content;
    if (enter.active || (enter.progress < 1 && hold.progress === 0)) {
      // Enter phase
      const p = enter.progress;
      const scale = std.tween(0.8, 1, p, "easeOutBack");
      const opacity = std.tween(0, 1, p, "easeOutCubic");
      content = card({ scale, opacity, y: 0 });
    } else if (exit.active || exit.progress > 0) {
      // Exit phase
      const p = exit.progress;
      const y = std.tween(0, -60, p, "easeInCubic");
      const opacity = std.tween(1, 0, p, "easeInCubic");
      content = card({ scale: 1, opacity, y });
    } else {
      // Hold phase (default)
      content = card({ scale: 1, opacity: 1, y: 0 });
    }

    const wrapperStyle = std.css({ width, height }) + ";" + std.css.center();

    return `<div style="${wrapperStyle}">${content}</div>`;
  },
});
