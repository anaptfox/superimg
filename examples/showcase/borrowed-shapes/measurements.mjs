// Run: node --import tsx examples/showcase/borrowed-shapes/measurements.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  INITIAL_FORMS, FOLLOWED_IDS, TREE_LIMB_TERMINAL_COUNTS,
  measureFormsTransport, measureTreeTipSeparation,
  measureTowerHorizontalSeparation, measureTreeForkDirections, observeForms, sampleForms,
} from "./model.ts";

const model = fileURLToPath(new URL("./model.ts", import.meta.url));
const report = {
  schemaVersion: 1,
  measuredOn: new Date().toISOString().slice(0, 10),
  kind: "borrowed-shapes/source-transport-measurement",
  modelSha256: createHash("sha256").update(readFileSync(model)).digest("hex"),
  ...measureFormsTransport(),
  treeReadability: {
    terminalCounts: TREE_LIMB_TERMINAL_COUNTS,
    forkDirections: measureTreeForkDirections(),
    primaryTipMinimumSeparation4K: measureTreeTipSeparation(),
    towerMinimumHorizontalCenterSeparation4K: measureTowerHorizontalSeparation(),
    followedIds: FOLLOWED_IDS,
  },
  holdObservations: [4.5, 12.5, 20.5].map(seconds => observeForms(sampleForms(INITIAL_FORMS, { seconds }))),
};
writeFileSync(new URL("./measurements.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ modelSha256: report.modelSha256, treeReadability: report.treeReadability, transitions: report.transitions.map(t => ({ from: t.semanticParts.from, to: t.semanticParts.to, endpoint: t.semanticParts.endpointWorld, peakStep4K: t.semanticParts.peakStep4K, baselineEndpoint: t.globalMorton.endpointWorld, baselinePartMismatches: t.globalMorton.partMismatch })) }, null, 2));
