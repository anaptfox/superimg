import { defineScene } from "superimg";

export default defineScene({
  data: {
    message: "Built with defineScene",
  },

  config: {
    duration: 3,
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; font-family: system-ui, sans-serif; }
      .message { color: white; font-size: 64px; font-weight: 700; }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const progress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div class="message" style="${std.css({ opacity, transform: "translateY(" + y + "px)" })}">
          ${data.message}
        </div>
      </div>
    `;
  },
});
