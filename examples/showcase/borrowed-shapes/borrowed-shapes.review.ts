import type { ReviewPlan } from "@foxworth/superimg";
import { INITIAL_FORMS, observeForms, sampleForms, validateFormsSnapshot } from "./model";

export default {
  schemaVersion: 1,
  beats: [
    { id: "bed", label: "All transported material starts on one bed", at: "0.25s" },
    { id: "gather", label: "Porcelain acquires the seed", at: "1.75s" },
    { id: "seed", label: "Five seed lobes and the core read together", at: "4.5s", crop: { x: 1850, y: 1070, width: 940, height: 690 } },
    { id: "tree-start", label: "Seed-to-tree transport starts without a cut", at: "6s" },
    { id: "tree-morph", label: "Seed lobes remain coherent as primary limbs", at: "8.5s", range: ["8s", "10s"] },
    { id: "tree-settle", label: "Branch transport slows before the hold", at: "10.5s" },
    { id: "tree", label: "Five limbs grow from the conserved trunk", at: "12.5s", crop: { x: 1650, y: 500, width: 1340, height: 1250 } },
    { id: "citadel-start", label: "The tree starts acquiring architecture", at: "14s" },
    { id: "citadel-morph", label: "Limbs become towers, trunk becomes a gate", at: "16.5s", range: ["16s", "18s"] },
    { id: "citadel-settle", label: "Tower transport slows before the hold", at: "18.5s" },
    { id: "citadel", label: "Five towers enclose an open courtyard", at: "20.5s", crop: { x: 1700, y: 820, width: 1250, height: 950 } },
    { id: "return-start", label: "The same material begins returning", at: "22s" },
    { id: "return-morph", label: "No grain respawns or visits an intermediate bed", at: "24.5s", range: ["24s", "26s"] },
    { id: "return-settle", label: "The returning seed decelerates", at: "26.5s" },
    { id: "seed-returned", label: "The last seed holds the exact first positions", at: "28.5s" },
  ],
  observe(ctx) {
    const snapshot = sampleForms({ ...INITIAL_FORMS, live: false, fidelity: ctx.data.fidelity === "reduced" ? "reduced" : "full" }, { seconds: ctx.timelineSeconds, frame: ctx.frame });
    const observed=observeForms(snapshot);
    return { ...observed, parts: {...observed.parts}, partsConserved: observed.parts.every(count=>count===3000), valid: validateFormsSnapshot(snapshot).length === 0 };
  },
  checks: [
    { id: "finite", label: "All sampled positions and normals are finite", metric: "finite", equals: true },
    { id: "continuous", label: "The authored clock matches continuous conserved poses", metric: "valid", equals: true },
    { id: "population", label: "The complete material population is conserved", metric: "logicalGrains", equals: 19600 },
    { id: "identities", label: "No transported identity is duplicated or lost", metric: "uniqueIds", equals: 18000 },
    { id: "followed", label: "All twelve followed identities remain drawable", metric: "followedVisible", equals: 12 },
    { id: "parts-conserved", label: "All six semantic parts retain three thousand grains", metric: "partsConserved", equals: true },
    { id: "tree-height", label: "The tree has its intended branching height", beat: "tree", metric: "maximumHeight", min: 360, max: 420 },
    { id: "five-tree-tips", label: "Five semantic limbs each have one terminal", beat: "tree", metric: "targetTreePrimaryTips", equals: 5 },
    { id: "one-tip-per-limb", label: "Secondary forks do not obscure the five-part lesson", beat: "tree", metric: "targetTreeMaximumTerminalsPerLimb", equals: 1 },
    { id: "tip-separation", label: "Primary limb tips project at least eighty pixels apart at 4K", beat: "tree", metric: "targetTreeTipSeparation4K", min: 80 },
    { id: "fork-direction", label: "First limb sections separate by eighteen degrees in the painted view", beat: "tree", metric: "targetTreeForkDirectionDegrees", min: 18 },
    { id: "fork-elbow-gap", label: "First elbows keep a clear conservative projected gap", beat: "tree", metric: "targetTreeElbowGap4K", min: 30 },
    { id: "tree-follow-facing", label: "All followed grains face the camera at the tree hold", beat: "tree", metric: "followedFrontFacing", equals: 12 },
    { id: "citadel-follow-facing", label: "All followed grains face the camera at the citadel hold", beat: "citadel", metric: "followedFrontFacing", equals: 12 },
    { id: "tower-height", label: "The citadel retains its five tower masses", beat: "citadel", metric: "maximumHeight", min: 290, max: 330 },
    { id: "tower-spacing", label: "Tower centers do not share the same screen column", beat: "citadel", metric: "targetTowerHorizontalCenterSeparation4K", min: 150 },
    { id: "seed-held", label: "The first held seed matches the target exactly", beat: "seed", metric: "returnedSeed", equals: true },
    { id: "exact-return", label: "The last seed matches every original target position", beat: "seed-returned", metric: "returnedSeed", equals: true },
  ],
} satisfies ReviewPlan;
