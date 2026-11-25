import { Html, video } from "@foxworth/superimg";

function panel(ctx: { width: number; height: number; timeline: { progress: number }; data: { title: string; accent: string }; asset: (name: string) => string }) {
  const { width, height, timeline, data } = ctx;
  const circleX = Math.round(width * (0.47 + 0.18 * timeline.progress));
  return Html({
    id: "panel",
    html: `<div class="portable-panel" style="width:${width}px;height:${height}px;--accent:${data.accent}">
      <div class="portable-panel__grid"></div>
      <div class="portable-panel__orb" style="left:${circleX}px;top:${Math.round(height * 0.47)}px"></div>
      <div class="portable-panel__copy">
        <div class="portable-panel__eyebrow">ONE CHILD · MANY CANVASES</div>
        <h1>${data.title}</h1>
        <p>Selected edition · local clock · nested reflow</p>
      </div>
      <img class="portable-panel__mark" src="${ctx.asset("mark")}" alt="" />
    </div>`,
  });
}

export default video({
  size: { width: 540, height: 720 },
  fps: 25,
  duration: "50f",
  sample: { title: "A reusable work", accent: "#f4b163" },
  variants: { cool: { title: "A selected version", accent: "#77d6db" } },
  editions: { square: { size: { width: 640, height: 640 }, render: panel } },
  assets: { mark: { url: "./assets/mark.svg", type: "image" } },
  inlineCss: [
    ".portable-panel{position:relative;overflow:hidden;background:#172540;color:#f7f3ea;font-family:system-ui,sans-serif}",
    ".portable-panel__grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff0c 1px,transparent 1px),linear-gradient(90deg,#ffffff0c 1px,transparent 1px);background-size:48px 48px}",
    ".portable-panel__orb{position:absolute;width:260px;height:260px;border:2px solid var(--accent);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 48px #ffffff08,0 0 0 96px #ffffff05}",
    ".portable-panel__copy{position:absolute;left:8%;top:19%;width:80%}.portable-panel__eyebrow{color:var(--accent);font-size:18px;font-weight:700;letter-spacing:.14em}.portable-panel h1{max-width:650px;margin:20px 0;font-size:clamp(42px,7vw,90px);line-height:.95}.portable-panel p{font-size:21px;color:#c2ccda}",
    ".portable-panel__mark{position:absolute;right:6%;bottom:7%;width:75px;height:75px}",
  ],
  render: panel,
});
