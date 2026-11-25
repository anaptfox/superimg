import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 640, height: 720, fps: 25, duration: "100f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const x = 45 + frame * 5.3;
    return Html({ id: "baseline", width: "fill", height: "fill", html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#183a43;color:#f4f1ea;font:600 25px system-ui"><div style="position:absolute;left:28px;top:24px;letter-spacing:.12em">BASELINE</div><div style="position:absolute;left:${x}px;top:320px;width:54px;height:54px;border-radius:50%;background:#78c9b0"></div><div style="position:absolute;left:28px;bottom:20px;font-size:15px">FRAME ${frame}</div></main>` });
  },
});
