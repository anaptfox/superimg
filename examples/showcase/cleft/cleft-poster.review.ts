import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_CLEFT, sampleCleft, observeCleft, type CleftInput } from "./model";

export default {
  schemaVersion: 1,
  beats: [{ id: "poster", label: "A square mineral lockup preserves the signature cut", at: "0s", crop: { x: 500, y: 300, width: 1160, height: 1250 } }],
  observe(ctx) { return observeCleft(sampleCleft({ ...INITIAL_CLEFT, live: false, ...ctx.data } as CleftInput, { kind: "poster", seconds: 0 })); },
  checks: [
    { id: "count", label: "Poster material uses the complete population", metric: "logicalPopulation", equals: 8192 },
    { id: "gap", label: "Poster negative space remains clear", metric: "gapClear", equals: true },
  ],
} satisfies ReviewPlan;
