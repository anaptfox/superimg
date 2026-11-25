import { video } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_CLEFT, sampleCleft, type CleftInput } from "./model";
import { renderCleft } from "./paint";

export { INITIAL_CLEFT, observeCleft, sampleCleft } from "./model";
export type { CleftInput } from "./model";

/** The gallery's pointer-driven scene; audio stays on exported films. */
export const live = video<CleftInput>({
  size: { width: 1280, height: 720 }, duration: "8s", fps: 30, poster: "4.8s",
  fonts: MATERIAL_FONTS,
  sample: { ...INITIAL_CLEFT },
  render(ctx) {
    return renderCleft(sampleCleft(ctx.data, { kind: "live", seconds: ctx.timeline.seconds, frame: ctx.timeline.frame }), {
      width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw,
    });
  },
});

export default video<CleftInput>({
  size: { width: 3840, height: 2160 }, duration: "18s", fps: 30, poster: "5s",
  audio: { id: "cleft-hero-score", src: "./assets/hero.wav", role: "ambient", duration: "18s" },
  fonts: MATERIAL_FONTS,
  sample: { ...INITIAL_CLEFT, live: false },
  variants: { teaching: { teaching: true } },
  render(ctx) {
    return renderCleft(sampleCleft(ctx.data, { kind: "hero", seconds: ctx.timeline.seconds, frame: ctx.timeline.frame }), {
      width: ctx.width, height: ctx.height, draw: ctx.std.svg.draw,
    });
  },
});
