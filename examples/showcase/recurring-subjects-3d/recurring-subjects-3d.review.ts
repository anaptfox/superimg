import type { ReviewPlan } from "@foxworth/superimg";
import { sampleMorning } from "./model";

export default {
  schemaVersion: 1,
  beats: [
    { id: "morning", label: "Two matching glazed mugs, grounded on oak and linen", at: "2s" },
    { id: "lift", label: "Hero leaves the frame before time changes", at: "4.8s", range: ["3.4s", "5s"] },
    { id: "return", label: "Later timestamp; the same mug returns half full", at: "6.4s", range: ["5s", "6.6s"] },
    { id: "interior", label: "Coffee surface and tide line read inside the hero", at: "7s" },
    { id: "resolve", label: "Camera reveals the unchanged counter mug and holds", at: "11s", range: ["7.6s", "10.5s"] },
  ],
  observe(ctx) {
    const frame = sampleMorning(ctx.timelineSeconds);
    return { entityCount: frame.mugs.length, heroFill: frame.mugs[0]!.data.state.fill,
      counterFill: frame.mugs[1]!.data.state.fill, heroY: frame.mugs[0]!.data.performance.position[1]!,
      sameDesign: frame.mugs[0]!.binding.designRevision === frame.mugs[1]!.binding.designRevision,
      projection: "boxed-webgl" };
  },
  checks: [
    { id: "population", label: "Two authored subject samples", metric: "entityCount", equals: 2 },
    { id: "shared", label: "Both refer to the accepted ceramic design revision", metric: "sameDesign", equals: true },
    { id: "counter", label: "Counter stays full", metric: "counterFill", equals: 1 },
    { id: "lifted", label: "Hero has lifted before ellipsis", beat: "lift", metric: "heroY", min: 34 },
    { id: "changed", label: "Hero is half full after the cut", beat: "interior", metric: "heroFill", equals: .55 },
  ],
} satisfies ReviewPlan;
