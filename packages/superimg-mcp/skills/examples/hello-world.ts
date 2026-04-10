// Minimal SuperImg template demonstrating core concepts
import { defineScene } from "superimg";

export default defineScene({
  defaults: {
    message: "Hello, SuperImg!",
    accentColor: "#667eea",
  },

  config: {
    duration: 3,
    inlineCss: [`
      * { margin: 0; box-sizing: border-box; }
      body { background: #0f0f23; font-family: system-ui, sans-serif; }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;

    // Animation progress (0→1 over first second)
    const progress = std.math.clamp(time / 1.0, 0, 1);

    // Animated values
    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({
          opacity,
          transform: "translateY(" + y + "px)",
          color: data.accentColor,
          fontSize: 64,
          fontWeight: 700,
        })}">${data.message}</div>
      </div>
    `;
  },
});
