import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1200, height: 675, fps: 25, duration: "7f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const x = 180 + frame * 110;
    return Html({ id: "demo", width: "fill", height: "fill", html: `<main style="width:100%;height:100%;background:#183a43;color:#f4f1ea;position:relative;font:600 38px system-ui"><div style="position:absolute;left:80px;top:64px">CHAPTER · THE DEMONSTRATION</div><div style="position:absolute;left:${x}px;top:300px;width:90px;height:90px;border-radius:50%;background:#78c9b0"></div><div style="position:absolute;right:80px;bottom:60px;font-size:22px">LOCAL FRAME ${frame}</div></main>` });
  },
});
