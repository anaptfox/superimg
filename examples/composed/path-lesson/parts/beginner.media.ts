import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1280, height: 720, fps: 25, duration: "40f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const x = 180 + frame * 18;
    return Html({ id: "beginner-explanation", width: "fill", height: "fill", html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#e6dec9;color:#142328;font:600 32px system-ui"><div style="position:absolute;left:100px;top:90px;max-width:950px">BEGINNER · LIGHT TRAVELS FASTER THAN THE EARTH TURNS</div><div style="position:absolute;left:120px;top:350px;width:110px;height:110px;border-radius:50%;background:#f2b35f"></div><div style="position:absolute;left:${x}px;top:390px;width:90px;height:24px;background:#142328;transform:skewY(-16deg);transform-origin:left center"></div><div style="position:absolute;left:100px;bottom:40px;font-size:18px">The Sun stays in place. Your viewpoint moves.</div></main>` });
  },
});
