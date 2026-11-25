import { createMediaIR } from "@superimg/types";

/** Shared fixture IR (schemaVersion 0) for framework portability tests. */
export const fixtureMediaIR = createMediaIR({
  sourceId: "fixture-demo",
  width: 800,
  height: 450,
  durationSeconds: 1,
  totalFrames: 30,
});
