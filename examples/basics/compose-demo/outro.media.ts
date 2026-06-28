import { define } from "superimg";

export default define({
  config: {
    fps: 30,
    duration: "2s",
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 100vw; height: 100vh; font-family: 'IBM Plex Sans', sans-serif;
        color: white; overflow: hidden; }
      .content { text-align: center; }
      .cta { font-size: 64px; font-weight: 700; }
    `],
  },
  sample: { cta: "Thanks for watching!" },
  render(ctx) {
    const { std, data } = ctx;
    const t = ctx.director({ enter: "70%", hold: "20%", exit: "10%" });
    const cta = t.motion({ during: "enter", scale: 0.88, y: 16, easing: "easeOutBack" });

    return `
      <div style="${std.css(std.css.fill(), std.css.center())}">
        <h1 class="cta" style="${cta.style}">${data.cta}</h1>
      </div>
    `;
  },
});