import { video } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_CLEFT, sampleCleft, type CleftInput } from "./model";
import { renderCleft } from "./paint";

export default video<CleftInput>({
  size: { width: 3840, height: 2160 }, duration: "4s", fps: 30, temporal: "loop", poster: "0s",
  fonts: MATERIAL_FONTS,
  audio: { id: "cleft-loop-score", src: "./assets/loop.wav", role: "ambient", duration: "4s" },
  sample: { ...INITIAL_CLEFT, live: false },
  render(ctx) {
    return renderCleft(sampleCleft(ctx.data, { kind: "loop", seconds: ctx.timeline.seconds, frame: ctx.timeline.frame }), {
      width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw, labels: false,
    });
  },
  editions: {
    square: {
      size: { width: 2160, height: 2160 },
      render(ctx) {
        return renderCleft(sampleCleft(ctx.data, { kind: "loop", seconds: ctx.timeline.seconds, frame: ctx.timeline.frame }), {
          width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw, labels: false,
        });
      },
    },
  },
});
