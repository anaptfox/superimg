import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    message: "Built with defineTemplate",
  },

  config: {
    fps: 30,
    durationSeconds: 3,
    width: 1920,
    height: 1080,
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const eased = std.easing.easeOutCubic(progress);
    const opacity = std.math.lerp(0, 1, eased);
    const y = std.math.lerp(30, 0, eased);

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
          font-family: system-ui, sans-serif;
        }
        .message {
          color: white;
          font-size: 64px;
          font-weight: 700;
          opacity: ${opacity};
          transform: translateY(${y}px);
        }
      </style>
      <div class="message">${data.message}</div>
    `;
  },
});
