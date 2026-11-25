import { Html, sequence, time, video } from "@foxworth/superimg";

const clip = video({
  size: { width: 320, height: 180 },
  fps: 25,
  duration: "7f",
  render: (ctx) => Html({
    width: "fill", height: "fill",
    html: `<div style="width:320px;height:180px;background:#10243c;color:#fff;display:grid;place-items:center;font:32px sans-serif">frame${ctx.timeline.frame}</div>`,
  }),
});

export default time(sequence([{ id: "clip", content: clip }]), {
  size: { width: 320, height: 180 }, fps: 25,
});
