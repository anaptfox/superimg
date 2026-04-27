import { defineScene } from "superimg";

export default defineScene({
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "3s",
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: white; overflow: hidden; }
      .heading { font-size: 64px; font-weight: 700; margin-bottom: 16px; }
      .body { font-size: 28px; opacity: 0.7; }
    `],
  },
  data: {
    heading: "Main Content",
    body: "Add your content here.",
  },
  render(ctx) {
    const opacity = ctx.std.interpolate(ctx.sceneProgress * 2, [0, 1], [0, 1], "easeOutCubic");
    return `
      <div style="${ctx.std.css.fill()};${ctx.std.css.center()}; flex-direction: column;
        background: #0f0f23;">
        <h2 class="heading" style="opacity: ${opacity}">${ctx.data.heading}</h2>
        <p class="body" style="opacity: ${opacity}">${ctx.data.body}</p>
      </div>
    `;
  },
});
