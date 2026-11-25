import { define, Html } from "@foxworth/superimg";

export default define({
  config: { width: 1280, height: 720, fps: 25, duration: "80f" },
  render(ctx) {
    const frame = ctx.timeline.frame;
    const angle = (frame * 4.5) % 360;
    return Html({ id: "advanced-explanation", width: "fill", height: "fill", html: `<main style="position:relative;width:100%;height:100%;overflow:hidden;background:#17253b;color:#eff3f5;font:600 31px system-ui"><div style="position:absolute;left:96px;top:70px">ADVANCED · PARALLAX FROM A ROTATING REFERENCE FRAME</div><div style="position:absolute;left:50%;top:52%;width:400px;height:250px;border:2px solid #65819c;border-radius:50%;transform:translate(-50%,-50%) rotate(${angle}deg)"></div><div style="position:absolute;left:calc(50% - 18px);top:calc(52% - 18px);width:36px;height:36px;border-radius:50%;background:#f2b35f"></div><div style="position:absolute;left:calc(50% + 166px);top:calc(52% - 18px);width:28px;height:28px;border-radius:50%;background:#86d4bd"></div><div style="position:absolute;left:96px;right:96px;bottom:54px;font-size:20px;color:#b2c1cb">Observed angular motion combines orbital translation, rotation, and the observer's changing line of sight.</div></main>` });
  },
});
