import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_CLEFT, sampleCleft, observeCleft, type CleftInput } from "./model";

export default {
  schemaVersion: 1,
  beats: [
    { id: "first", label: "First encoded frame starts the periodic current", at: "f:0" },
    { id: "middle", label: "The light crosses a fixed mineral geometry", at: "f:60", range: ["0s", "3s"] },
    { id: "last", label: "The final encoded frame approaches the next cycle", at: "f:119" },
  ],
  observe(ctx) {
    return observeCleft(sampleCleft({ ...INITIAL_CLEFT, live: false, ...ctx.data } as CleftInput, {
      kind: "loop", seconds: ctx.timelineSeconds, frame: ctx.frame,
    }));
  },
  checks: [
    { id: "count", label: "The loop preserves the full population", metric: "logicalPopulation", equals: 8192 },
    { id: "gap", label: "The loop never deposits grains in the cut", metric: "gapClear", equals: true },
    { id: "phase-start", label: "The first frame begins at exact phase zero", beat: "first", metric: "loop.phase", equals: 0 },
    { id: "phase-mid", label: "The 60th frame lies at the half cycle", beat: "middle", metric: "loop.phase", equals: 0.5 },
    { id: "no-duplicate", label: "The last encoded frame is not phase one", beat: "last", metric: "loop.phase", max: 0.999 },
  ],
} satisfies ReviewPlan;
