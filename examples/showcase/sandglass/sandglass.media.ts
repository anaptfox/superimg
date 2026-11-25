import { video } from "@foxworth/superimg";
import { defineInteractive } from "@foxworth/superimg/interactive/define";
import { MATERIAL_FONTS } from "../_material/resources";
import { INITIAL_SANDGLASS, sampleSandglass, sampleFilmClock, observeSandglass, type SandglassData } from "./model";
import { renderSandglass } from "./render";

export { INITIAL_SANDGLASS } from "./model";

/** The host owns simulation time. Guide time never advances the queue. */
export const live = defineInteractive<SandglassData>({
  size: { width: 1280, height: 720 },
  sample: { ...INITIAL_SANDGLASS, live: true, compare: false },
  guide: {
    id: "sandglass-live",
    steps: [
      { id: "observe", label: "Observe the queue", duration: "16s", scene: { state: "observe" }, note: "One cluster is one request. The host controls model time." },
      { id: "compare", label: "Compare capacity", duration: "16s", scene: { state: "compare" }, note: "Change workers or arrival rate, then replay from zero." },
      { id: "reflect", label: "Follow a request", duration: "17s", scene: { state: "reflect" }, note: "Inspect elapsed waiting and its service boundaries." },
    ],
  },
  render(ctx) {
    const snapshot = sampleSandglass(ctx.data, { logicalSeconds: ctx.data.logicalSeconds, speed: 1, held: true });
    ctx.scene.states({ observe: {}, compare: {}, reflect: {} });
    ctx.scene.register({ id: "sandglass-stage", role: "model", label: "Sandglass queue", metadata: observeSandglass(snapshot) });
    for (const system of snapshot.systems) ctx.scene.register({ id: `${system.id}-vessel`, role: "queue", label: `${system.workers} workers`, metadata: { ...system.counts, workers: system.workers, inputVersion: snapshot.inputVersion } });
    return renderSandglass(snapshot, { width: ctx.width, height: ctx.height, fidelity: ctx.data.fidelity, teaching: ctx.data.teaching, live: true });
  },
});

export const film = video<SandglassData>({
  size: { width: 3840, height: 2160 },
  duration: "40s",
  fps: 30,
  audio: { id: "sandglass-score", src: "./assets/score.wav", role: "sfx", duration: "40s" },
  fonts: [...MATERIAL_FONTS],
  poster: "16s",
  sample: { ...INITIAL_SANDGLASS },
  variants: { teaching: { teaching: true } },
  render(ctx) {
    const snapshot = sampleSandglass(ctx.data, sampleFilmClock(ctx.timeline.seconds));
    return renderSandglass(snapshot, { width: ctx.width, height: ctx.height, fidelity: ctx.data.fidelity, teaching: ctx.data.teaching });
  },
});

export default film;
