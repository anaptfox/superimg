import { video } from "@foxworth/superimg";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_FORMS, sampleForms, type FormsInput } from "./model";
import { renderForms } from "./render";

export { INITIAL_FORMS, sampleForms, observeForms } from "./model";
export type { FormsInput } from "./model";
export { galleryLive } from "./gallery";

/** Passive player clock: scrub in either direction; identity follows authored time. */
export const live = video<FormsInput>({
  size: { width: 1280, height: 720 }, duration: "30s", fps: 30,
  fonts: MATERIAL_FONTS, poster: "12.5s", sample: { ...INITIAL_FORMS },
  render(ctx) {
    const snapshot = sampleForms(ctx.data, { seconds: ctx.timeline.seconds, frame: ctx.timeline.frame });
    return renderForms(snapshot, { width: ctx.width, height: ctx.height, teaching: ctx.data.teaching, followGrains: ctx.data.followGrains, live: ctx.data.live });
  },
});

export const film = video<FormsInput>({
  size: { width: 3840, height: 2160 }, duration: "30s", fps: 30,
  fonts: MATERIAL_FONTS, poster: "12.5s",
  audio: { id: "borrowed-shapes-score", src: "./assets/score.wav", role: "ambient", duration: "30s" },
  sample: { ...INITIAL_FORMS, live: false },
  variants: { teaching: { teaching: true } },
  render(ctx) {
    const snapshot = sampleForms(ctx.data, { seconds: ctx.timeline.seconds, frame: ctx.timeline.frame });
    return renderForms(snapshot, { width: ctx.width, height: ctx.height, teaching: ctx.data.teaching, followGrains: ctx.data.followGrains, live: ctx.data.live });
  },
});

export default film;
