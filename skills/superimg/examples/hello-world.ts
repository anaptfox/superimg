// Minimal SuperImg template demonstrating core concepts
import { defineScene } from "superimg";

export default defineScene({
  data: {
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
    const { std, width, height, data } = ctx;

    // score() defaults to enter 15% / hold 70% / exit 15%
    const t = std.score();

    // Auto fade-in, hold, then fade-out. Slides up from y:30 on entrance.
    const card = t.motion({ y: 30 });

    return `
      <div style="${std.css({ width, height }, std.css.center())}">
        <div style="${std.css({
          color: data.accentColor,
          fontSize: 64,
          fontWeight: 700,
        })}; ${card.style}">${data.message}</div>
      </div>
    `;
  },
});
