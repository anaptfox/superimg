import { define } from "superimg";

export default define({
  sample: {
    label: "Frame-accurate clip",
  },

  config: {
    width: 1280,
    height: 720,
    fps: 30,
    duration: "4s",
    assets: {
      clip: "../../marketing/countdown/output.mp4",
    },
    inlineCss: [
      "* { margin: 0; box-sizing: border-box; }",
      "body { font-family: system-ui; color: #fff; overflow: hidden; }",
    ],
  },

  render(ctx) {
    const { std, width, height, data, assets } = ctx;
    const t = ctx.director({ intro: "0.5s", main: "3s", outro: "0.5s" });

    const clip = std.video.sync({
      src: assets.clip?.url ?? "",
      at: ctx.timeline.seconds,
      width: 640,
      height: 360,
      objectFit: "cover",
    });

    const label = t.clip({ during: "main" }).director().motion({ y: 12 });
    const badge = t.motion({ scale: 0.9 });

    return `
      <div style="${std.css(
        {
          width,
          height,
          background: "linear-gradient(135deg, #ff6b6b 0%, #feca57 35%, #48dbfb 70%, #ff9ff3 100%)",
          position: "relative",
        },
        std.css.column(),
      )}">
        <div style="${std.css(
          {
            width: "100%",
            padding: "20px 32px",
            background: "rgba(0,0,0,0.35)",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          },
          badge.style,
        )}">
          Outside frame — SuperImg composition
        </div>

        <div style="${std.css({ flex: 1 }, std.css.center(), std.css.column())}">
          <div style="${std.css(
            {
              padding: 12,
              borderRadius: 20,
              background: "#fff",
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
              border: "6px dashed #1a1a2e",
            },
            std.css.column(),
            std.css.center(),
          )}">
            <div style="${std.css({
              fontSize: 14,
              fontWeight: 700,
              color: "#1a1a2e",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
            })}">
              Embedded clip (ffmpeg frame)
            </div>
            <div style="${std.css({ borderRadius: 12, overflow: "hidden", lineHeight: 0 })}">
              ${clip.html}
            </div>
          </div>

          <p style="${std.css(
            {
              marginTop: 28,
              fontSize: 32,
              fontWeight: 600,
              color: "#1a1a2e",
              textShadow: "0 2px 0 rgba(255,255,255,0.6)",
              padding: "12px 24px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.85)",
            },
            label.style,
          )}">
            ${data.label} · t=${clip.time.toFixed(2)}s
          </p>
        </div>

        <div style="${std.css({
          width: "100%",
          padding: "14px 32px",
          background: "rgba(0,0,0,0.4)",
          fontSize: 18,
          fontWeight: 500,
        })}">
          If you only see black, the outer rainbow gradient and white card should still be visible.
        </div>
      </div>
    `;
  },
});