import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_ATLAS, sampleAtlas, observeAtlas, atlasTimeForRouteProgress, type AtlasInput } from "./model";
import { ATLAS_TURNS } from "./route";
import { projectAtlas } from "./projection";

const turnTimes = ATLAS_TURNS.map(turn => `${atlasTimeForRouteProgress(turn.progress).toFixed(3)}s`);

export default {
  schemaVersion: 1,
  beats: [
    { id: "bed", label: "The material begins as a bed without architecture height", at: "1s" },
    { id: "first-quay", label: "The first quay gathers around the south causeway", at: "5.8s" },
    { id: "port", label: "Port City adds the cistern and markets", at: "9.8s" },
    { id: "present", label: "Present Terraces reveals all three landmarks", at: "12.8s", crop: { x: 760, y: 360, width: 2350, height: 1440 } },
    { id: "descent", label: "The camera descends inside the open route corridor", at: "15s" },
    { id: "turn-one", label: "The first left turn agrees with the minimap", at: turnTimes[0]! },
    { id: "turn-two", label: "The next right turn preserves orientation", at: turnTimes[1]! },
    { id: "turn-three", label: "The far right turn remains inside the corridor", at: turnTimes[2]! },
    { id: "turn-four", label: "The final left turn retains visible route and architecture", at: turnTimes[3]!, range: ["23.4s", "24.4s"], crop: { x: 680, y: 320, width: 2450, height: 1440 } },
    { id: "arrival", label: "The tidal archive and map report the same arrival", at: "25.6s" },
    { id: "lift", label: "Architecture stays visible during the vertical rise", at: "27.7s", range: ["27s", "29s"] },
    { id: "roof-reveal", label: "Roof grains remain visible before lateral travel", at: "28.2s" },
    { id: "raised", label: "Raised Shore is explicitly labeled as imagined", at: "35s" },
    { id: "reset", label: "Raised Shore returns to the shared Present baseline", at: "36.5s", range: ["36s", "39s"] },
    { id: "present-baseline", label: "Present is fully restored before Open Shore", at: "37s" },
    { id: "open", label: "Open Shore uses the same camera and present footprint", at: "40.5s" },
    { id: "comparison", label: "The slate Raised perimeter remains beneath Open Shore", at: "41.5s" },
    { id: "future-ends", label: "Speculation dissolves before present architecture erodes", at: "42.6s" },
    { id: "erosion", label: "The present city progressively returns to grains", at: "44.5s", range: ["43.5s", "45.5s"] },
    { id: "traces", label: "Route and landmark traces persist after settling", at: "48.5s" },
    { id: "final", label: "The traces hold as a readable final image", at: "49.5s" },
  ],
  observe(ctx) {
    const data = { ...INITIAL_ATLAS, ...ctx.data, live: false, logicalSeconds: ctx.timelineSeconds } as AtlasInput;
    const snapshot = sampleAtlas(data);
    return observeAtlas(snapshot, projectAtlas(snapshot, ctx.width, ctx.height));
  },
  checks: [
    { id: "grain-conservation", label: "Every pose retains 24000 logical grains", metric: "grains.total", equals: 24000 },
    { id: "camera-finite", label: "The camera basis is finite", metric: "camera.finite", equals: true },
    { id: "camera-clearance", label: "The eye remains at least six world units clear", metric: "camera.clearance", min: 6 },
    { id: "route-yaw", label: "The route gaze turns at no more than sixty degrees per second", metric: "camera.routeYawRate", max: 60.000001 },
    { id: "same-route", label: "The minimap position derives from the visible route", metric: "minimap.sameRoute", equals: true },
    { id: "exclusive-futures", label: "Raised and Open are alternative futures", metric: "future.exclusive", equals: true },
    { id: "matte-limit", label: "Matte covers less than one-quarter of geometric façade area", metric: "material.facadeMatteCoverage", max: 0.249999 },
    { id: "bed-tide-ridge", label: "The pale tide ridge uses 800 conserved bed grains", metric: "geography.tideGrains", equals: 800 },
    { id: "bed-land", label: "Warm land uses 1000 conserved bed grains", metric: "geography.landGrains", equals: 1000 },
    { id: "bed-water", label: "Cool water uses 200 conserved bed grains", metric: "geography.waterGrains", equals: 200 },
    { id: "bed-sides", label: "Land and water grains occupy their authored sides", metric: "geography.classified", equals: true },
    { id: "causeway-coast", label: "The causeway crosses the shared shore", metric: "geography.causewayCrosses", equals: true },
    { id: "bed-height", label: "Opening grains have no architectural height", beat: "bed", metric: "grains.maximumHeight", max: 2 },
    { id: "present-era", label: "The present overview reaches its authored era", beat: "present", metric: "material.era", min: 1.99 },
    { id: "present-terraces", label: "Present reveals four stepped mineral terraces", beat: "present", metric: "geography.terracedMasses", equals: 4 },
    ...["turn-one", "turn-two", "turn-three", "turn-four"].flatMap(beat => [
      { id: `${beat}-route`, label: "Route grains project through the turn", beat, metric: "grains.projectedRoute", min: 60 },
      { id: `${beat}-architecture`, label: "Architecture projects during the street turn", beat, metric: "grains.projectedArchitecture", min: 250 },
    ]),
    { id: "arrived", label: "The route sampler reports arrival", beat: "arrival", metric: "navigation.nextTurn", equals: "arrived" },
    { id: "lift-architecture", label: "The rising view retains architectural grains", beat: "lift", metric: "grains.projectedArchitecture", min: 100 },
    { id: "roof-grains", label: "The vertical lift reveals roof grains", beat: "roof-reveal", metric: "grains.projectedRoofs", min: 100 },
    { id: "raised-label", label: "Raised Shore is explicitly an imagined future", beat: "raised", metric: "future.label", equals: "Imagined future: Raised Shore" },
    { id: "present-restored", label: "Present is the complete comparison baseline", beat: "present-baseline", metric: "future.present", equals: 1 },
    { id: "open-label", label: "Open Shore is explicitly an imagined future", beat: "open", metric: "future.label", equals: "Imagined future: Open Shore" },
    { id: "raised-memory", label: "The other alternative remains as a slate trace", beat: "comparison", metric: "future.raisedGhost", equals: 1 },
    { id: "present-before-erosion", label: "The futures dissolve before erosion", beat: "future-ends", metric: "future.present", equals: 1 },
    { id: "settled-height", label: "Final architectural particles settle below two units", beat: "traces", metric: "grains.maximumHeight", max: 2 },
    { id: "final-route", label: "The final cyan route remains projected", beat: "traces", metric: "grains.projectedRoute", min: 1000 },
    { id: "final-landmarks", label: "All protected landmark grains retain trace positions", beat: "traces", metric: "grains.projectedLandmarks", min: 6000 },
  ],
} satisfies ReviewPlan;
