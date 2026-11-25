import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_CLEFT, sampleCleft, observeCleft, type CleftInput } from "./model";

export default {
  schemaVersion: 1,
  beats: [
    { id: "quiet", label: "The sting starts with a quiet embossed contour", at: "0.2s" },
    { id: "draw", label: "Lower contour follows upper by 120ms", at: "0.8s", range: ["0.35s", "1.5s"] },
    { id: "hold", label: "A full frontal mark holds before changing material", at: "2s" },
    { id: "current", label: "Mineral current preserves the fixed silhouette", at: "3.6s", range: ["2.5s", "4.8s"] },
    { id: "resolve", label: "The caption and material settle together", at: "5.6s" },
  ],
  observe(ctx) {
    return observeCleft(sampleCleft({ ...INITIAL_CLEFT, live: false, ...ctx.data } as CleftInput, {
      kind: "sting", seconds: ctx.timelineSeconds, frame: ctx.frame,
    }));
  },
  checks: [
    { id: "count", label: "The same grain population survives the sting", metric: "logicalPopulation", equals: 8192 },
    { id: "finite", label: "All grain positions remain finite", metric: "finite", equals: true },
    { id: "gap", label: "The signature cut remains free of grain centers", metric: "gapClear", equals: true },
    { id: "hold", label: "The mark fully settles during the hold", beat: "hold", metric: "reveal.fill", equals: 1 },
    { id: "mineral", label: "Mineral paint fills the later sting", beat: "current", metric: "material.mineral", equals: 1 },
  ],
} satisfies ReviewPlan;
