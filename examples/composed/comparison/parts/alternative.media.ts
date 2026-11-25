import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 640, height: 720, fps: 25, duration: "72f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const y = 190 + Math.sin(frame / 8) * 90;
    return Html({ id: "alternative", width: "fill", height: "fill", html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#272d48;color:#f4f1ea;font:600 25px system-ui"><div style="position:absolute;left:28px;top:24px;letter-spacing:.12em">ALTERNATIVE</div><div style="position:absolute;left:293px;top:${y.toFixed(1)}px;width:56px;height:180px;border-radius:28px;background:#b5a5eb"></div><div style="position:absolute;left:28px;bottom:20px;font-size:15px">FRAME ${frame}</div></main>` });
  },
});
