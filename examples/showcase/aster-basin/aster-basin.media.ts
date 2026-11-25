import { video } from "@foxworth/superimg";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_ATLAS, sampleAtlas, observeAtlas, type AtlasInput } from "./model";
import { projectAtlas } from "./projection";
import { renderAtlas } from "./paint";

export { INITIAL_ATLAS, sampleAtlas, observeAtlas, atlasHeroPose, routeSampler, atlasOverhead } from "./model";
export type { AtlasInput } from "./model";

/** The host owns era, alternative, route, and logical time; guide time is inert. */
export const live = defineInteractive<AtlasInput>({
  size: { width: 1280, height: 720 },
  sample: { ...INITIAL_ATLAS },
  guide: {
    id: "aster-basin-live",
    steps: [
      { id: "overview", label: "Read the city", duration: "13s", scene: { state: "overview" }, note: "Explore three eras and focus on the causeway, cistern, and archive." },
      { id: "journey", label: "Follow the route", duration: "17s", scene: { state: "journey" }, note: "One route drives the camera, ground grains, and map." },
      { id: "futures", label: "Imagine two futures", duration: "12s", scene: { state: "futures" }, note: "Each alternative begins from the same Present Terraces." },
      { id: "traces", label: "Unmake and restore", duration: "8s", scene: { state: "traces" }, note: "Route and landmark traces persist after the architecture settles." },
    ],
  },
  render(ctx) {
    const snapshot = sampleAtlas(ctx.data);
    const projection = projectAtlas(snapshot, ctx.width, ctx.height);
    ctx.scene.states({ overview: {}, journey: {}, futures: {}, traces: {} });
    ctx.scene.register({ id: "atlas-stage", role: "model", label: "Aster Basin", metadata: observeAtlas(snapshot, projection) });
    return renderAtlas(snapshot, { width: ctx.width, height: ctx.height, projection });
  },
});

export default video<AtlasInput>({
  size: { width: 3840, height: 2160 }, duration: "50s", fps: 30, poster: "12.8s",
  fonts: [...MATERIAL_FONTS],
  audio: { id: "aster-basin-score", src: "./assets/score.wav", role: "ambient", duration: "50s" },
  sample: { ...INITIAL_ATLAS, live: false },
  variants: { teaching: { teaching: true } },
  render(ctx) {
    const snapshot = sampleAtlas({ ...ctx.data, live: false, logicalSeconds: ctx.timeline.seconds });
    const projection = projectAtlas(snapshot, ctx.width, ctx.height);
    return renderAtlas(snapshot, { width: ctx.width, height: ctx.height, projection });
  },
});
