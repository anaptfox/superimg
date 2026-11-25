import { video } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_CLEFT, sampleCleft, type CleftInput } from "./model";
import { renderCleft } from "./paint";

export default video<CleftInput>({
  size: { width: 3840, height: 2160 }, duration: "6s", fps: 30, poster: "5.5s",
  fonts: MATERIAL_FONTS,
  audio: { id: "cleft-sting-score", src: "./assets/sting.wav", role: "sfx", duration: "6s" },
  sample: { ...INITIAL_CLEFT, live: false },
  variants: { teaching: { teaching: true } },
  render(ctx) {
    return renderCleft(sampleCleft(ctx.data, { kind: "sting", seconds: ctx.timeline.seconds, frame: ctx.timeline.frame }), {
      width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw,
    });
  },
});
