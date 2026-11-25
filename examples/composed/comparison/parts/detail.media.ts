import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 640, height: 360, fps: 25, duration: "48f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const scale = 1 + frame * 0.014;
    return Html({ id: "detail", width: "fill", height: "fill", html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#f0bc65;color:#182026;font:700 20px system-ui"><div style="position:absolute;left:20px;top:16px;letter-spacing:.1em">DETAIL · PICTURE IN PICTURE</div><div style="position:absolute;left:50%;top:53%;width:84px;height:84px;border:8px solid #182026;border-radius:50%;transform:translate(-50%,-50%) scale(${scale.toFixed(2)})"></div><div style="position:absolute;left:20px;bottom:14px;font-size:13px">FRAME ${frame}</div></main>` });
  },
});
