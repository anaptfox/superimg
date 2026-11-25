import { video, Html } from "@foxworth/superimg";

export default video({
  size: { width: 64, height: 64 },
  duration: "4s",
  fps: 30,
  render: (ctx) => Html({ html: `<div style="width:64px;height:64px;background:rgb(${Math.round(ctx.timeline.progress * 255)},80,160)"></div>` }),
});
