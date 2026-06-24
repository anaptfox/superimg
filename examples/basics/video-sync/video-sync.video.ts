import { defineScene } from "superimg";

export default defineScene({
  sample: {
    label: "Frame-accurate clip",
  },

  config: {
    width: 1280,
    height: 720,
    fps: 30,
    duration: 4,
    assets: {
      clip: "../../marketing/countdown/output.mp4",
    },
    inlineCss: [
      "* { margin: 0; box-sizing: border-box; }",
      "body { background: #0a0a12; font-family: system-ui; color: #fff; overflow: hidden; }",
    ],
  },

  render(ctx) {
    const { std, width, height, data, assets } = ctx;
    const t = std.score({ intro: "0.5s", main: "3s", outro: "0.5s" });

    const clip = std.video.sync({
      src: assets.clip?.url ?? "",
      at: ctx.sceneTimeSeconds,
      width: 720,
      height: 405,
      objectFit: "cover",
    });

    const label = t.clip({ during: "main" }).score().motion({ y: 16 });

    return `
      <div style="${std.css({ width, height }, std.css.center(), std.css.column())}">
        <div style="${std.css({ borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" })}">
          ${clip.html}
        </div>
        <p style="${std.css({ marginTop: 24, fontSize: 24, opacity: 0.8 }, label.style)}">
          ${data.label} · t=${clip.time.toFixed(2)}s
        </p>
      </div>
    `;
  },
});