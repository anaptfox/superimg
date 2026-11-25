import type { ReviewPlan } from "@foxworth/superimg";
import { sampleLedger, ledgerTime } from "./tide-ledger.media";
import { observeAtlas } from "./model";
import { projectAtlas } from "./projection";

export default {
  schemaVersion: 1,
  beats: [
    { id: "bed", label: "Salt paper and tide ridge precede the architecture", at: ".6s" },
    { id: "quay", label: "The causeway grows across the pale tidal edge", at: "3.8s", range: ["1s", "3s"] },
    { id: "port", label: "The cistern court identifies Port City", at: "5.8s" },
    { id: "present", label: "The overhead plan retains all three landmarks", at: "7.8s", crop: { x: 530, y: 300, width: 1900, height: 1360 } },
    { id: "route", label: "A single route joins the same landmarks", at: "10.7s", range: ["8s", "10s"] },
    { id: "raised", label: "Raised Shore is labeled as an imagined alternative", at: "13.2s" },
    { id: "reset", label: "The alternative passes through the same present", at: "13.99s" },
    { id: "open", label: "Open Shore retains umber present and slate memory contours", at: "15.9s", range: ["14s", "16s"] },
    { id: "traces", label: "Buildings unmake while route and landmark traces hold", at: "17.8s", range: ["16s", "18s"] },
  ],
  observe(ctx) {
    const snapshot = sampleLedger(ctx.timelineSeconds, Boolean(ctx.data.teaching));
    return {
      ...observeAtlas(snapshot, projectAtlas(snapshot, ctx.width * .665, ctx.height * .78)),
      ledger: { modelSeconds: ledgerTime(ctx.timelineSeconds), overhead: snapshot.camera.eye.x === snapshot.camera.target.x && snapshot.camera.eye.z === snapshot.camera.target.z },
    };
  },
  checks: [
    { id: "population", label: "The existing model retains 24000 stable grains", metric: "grains.total", equals: 24000 },
    { id: "overhead", label: "The overhead camera stays fixed through every era", metric: "ledger.overhead", equals: true },
    { id: "finite", label: "All projected geometry stays finite", metric: "camera.finite", equals: true },
    { id: "one-route", label: "The route and navigation share the canonical sampler", metric: "minimap.sameRoute", equals: true },
    { id: "exclusive", label: "The alternatives remain exclusive", metric: "future.exclusive", equals: true },
    { id: "bed-height", label: "The material bed has no erected architecture", beat: "bed", metric: "grains.maximumHeight", max: 2 },
    { id: "present", label: "The plan reaches Present Terraces", beat: "present", metric: "material.era", min: 1.99 },
    { id: "raised", label: "The Raised shoreline is explicitly imagined", beat: "raised", metric: "future.label", equals: "Imagined future: Raised Shore" },
    { id: "open", label: "The Open shoreline is explicitly imagined", beat: "open", metric: "future.label", equals: "Imagined future: Open Shore" },
    { id: "memory", label: "Open retains the slate Raised perimeter", beat: "open", metric: "future.raisedGhost", equals: 1 },
    { id: "settled", label: "Unmade buildings settle into the paper", beat: "traces", metric: "grains.maximumHeight", max: 2 },
    { id: "route-traces", label: "The final overhead route remains readable", beat: "traces", metric: "grains.projectedRoute", min: 1800 },
    { id: "landmark-traces", label: "The three final landmarks retain their grain traces", beat: "traces", metric: "grains.projectedLandmarks", min: 6500 },
  ],
} satisfies ReviewPlan;
