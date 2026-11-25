import { video } from "@foxworth/superimg";
import { INITIAL_PROCESS, filmData, type ProcessData } from "./model";
import { renderProcess } from "./scene";

export default video<ProcessData>({
  size: { width: 640, height: 360 },
  duration: "5s", fps: 12, poster: "2.4s",
  sample: INITIAL_PROCESS,
  render(ctx) {
    return renderProcess(filmData(ctx.timeline.seconds), ctx.width, ctx.height);
  },
});
