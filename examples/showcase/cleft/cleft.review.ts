import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_CLEFT, sampleCleft, observeCleft, type CleftInput, CLEFT_PATHS } from "./model";

export default {
  schemaVersion: 1,
  beats: [
    { id: "establish", label: "The quiet embossed contour establishes the cut", at: "1s" },
    { id: "draw", label: "Both slabs draw around the stepped gap", at: "3s", range: ["2s", "4s"] },
    { id: "hold", label: "The frontal silhouette holds before the macro", at: "5s" },
    { id: "macro", label: "Grains and relief remain readable beside the cleft", at: "8.5s", crop: { x: 900, y: 380, width: 2040, height: 1250 }, range: ["7s", "9s"] },
    { id: "return", label: "The mark returns to exactly the frontal placement", at: "12s" },
    { id: "ink", label: "Flat ink preserves the same two contours", at: "12.65s" },
    { id: "mineral", label: "Granular mineral changes paint without moving the mark", at: "13.55s", range: ["12s", "15s"] },
    { id: "graphite", label: "Etched graphite retains the gap and slab geometry", at: "15.3s" },
    { id: "final", label: "The signature cut resolves in a held lockup", at: "17s" },
  ],
  observe(ctx) {
    return observeCleft(sampleCleft({ ...INITIAL_CLEFT, live: false, ...ctx.data } as CleftInput, {
      kind: "hero", seconds: ctx.timelineSeconds, frame: ctx.frame,
    }));
  },
  checks: [
    { id: "stable-population", label: "The logical grain population is conserved", metric: "logicalPopulation", equals: 8192 },
    { id: "finite-geometry", label: "All canonical grains have finite geometry", metric: "finite", equals: true },
    { id: "clear-gap", label: "Grain centers stay inside their own slab", metric: "gapClear", equals: true },
    { id: "fixed-contours", label: "Every material uses the canonical contours", metric: "contourIdentity", equals: CLEFT_PATHS.join("|") },
    { id: "complete-draw", label: "The mark fully settles before the macro", beat: "hold", metric: "reveal.fill", equals: 1 },
    { id: "macro-geometry", label: "The macro reveals the cleft at enlarged scale", beat: "macro", metric: "camera.scale", min: 2.79 },
    { id: "frontal-return", label: "The camera returns to the original scale", beat: "return", metric: "camera.scale", equals: 1 },
    { id: "ink-paint", label: "Flat ink reaches a clean settled sample", beat: "ink", metric: "material.ink", equals: 1 },
    { id: "mineral-paint", label: "The mineral sample reaches full paint", beat: "mineral", metric: "material.mineral", equals: 1 },
    { id: "graphite-paint", label: "Graphite reaches a clean settled sample", beat: "graphite", metric: "material.graphite", equals: 1 },
    { id: "cut-width", label: "Canonical negative space remains ten units wide", metric: "silhouette.minimumGap", equals: 10 },
  ],
} satisfies ReviewPlan;
