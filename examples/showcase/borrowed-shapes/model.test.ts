import { describe, expect, it } from "vitest";
import { layoutFollowLabels } from "./render";
import {
  FORM_TARGETS, FOLLOWED_IDS, INITIAL_FORMS, FORMS_SOUND_CUES, measureFormsTransport,
  sampleForms, observeForms, validateFormsSnapshot, quintic, transportPosition,
  TREE_PRIMARY_TIPS, TREE_PRIMARY_FORKS, TREE_LIMB_TERMINAL_COUNTS, measureTreeForkDirections, formsPose, formsPartProgress, measureTreeTipSeparation, measureTowerHorizontalSeparation,
} from "./model";

describe("six conserved semantic parts", () => {
  it("keeps five countable limb tips and follows front-facing tall-form samples", () => {
    expect(TREE_PRIMARY_TIPS).toHaveLength(5);
    expect(TREE_LIMB_TERMINAL_COUNTS).toEqual([1, 1, 1, 1, 1]);
    expect(measureTreeTipSeparation()).toBeGreaterThanOrEqual(80);
    expect(measureTreeTipSeparation(TREE_PRIMARY_TIPS.map(() => TREE_PRIMARY_TIPS[0]!))).toBe(0);
    expect(measureTowerHorizontalSeparation()).toBeGreaterThanOrEqual(150);
    expect(measureTowerHorizontalSeparation(Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 0 })))).toBe(0);
    expect(new Set(FOLLOWED_IDS).size).toBe(12);
    for (let part = 0; part < 6; part++) expect(FOLLOWED_IDS.filter(id => Math.floor(id / 3000) === part)).toHaveLength(2);
    for (const seconds of [12.5, 20.5]) expect(observeForms(sampleForms(INITIAL_FORMS, { seconds })).followedFrontFacing).toBe(12);
  });
  it("separates the first fork directions and rejects coincident limbs", () => {
    const forks = measureTreeForkDirections();
    expect(forks.minimumDegrees).toBeGreaterThanOrEqual(18);
    expect(forks.minimumElbowGap4K).toBeGreaterThanOrEqual(30);
    const collapsed = measureTreeForkDirections(TREE_PRIMARY_FORKS.map(() => TREE_PRIMARY_FORKS[0]!));
    expect(collapsed.minimumDegrees).toBe(0);
    expect(collapsed.minimumElbowGap4K).toBeLessThan(0);
  });
  it("stages limbs before the core and reaches every original endpoint on time", () => {
    const start = formsPose(6.1);
    expect(formsPartProgress(start, 1)).toBeGreaterThan(0);
    expect(formsPartProgress(start, 2)).toBe(0);
    expect(formsPartProgress(start, 0)).toBe(0);
    for (const seconds of [10.999999, 18.999999, 26.999999]) {
      const pose = formsPose(seconds);
      for (let part = 0; part < 6; part++) expect(formsPartProgress(pose, part)).toBeGreaterThan(.999999);
    }
    for (const seconds of [11, 19, 27]) for (let part = 0; part < 6; part++) expect(formsPartProgress(formsPose(seconds), part)).toBe(1);
  });
  it("places twelve deterministic labels without collisions during forward or reverse seeking", () => {
    for (let frame = 0; frame < 900; frame += 3) {
      const snapshot = sampleForms(INITIAL_FORMS, { seconds: frame / 899 * 30 });
      const labels = layoutFollowLabels(snapshot, 1280, 720);
      expect(new Set(labels.map(label => label.id)).size).toBe(12);
      expect(layoutFollowLabels(snapshot, 1280, 720)).toEqual(labels);
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!, b = labels[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y - a.height < b.y && b.y - b.height < a.y;
        expect(overlap).toBe(false);
      }
    }
  });
  it("keeps all identities and exact part counts through every phase", () => {
    for (const seconds of [0, 1.75, 4.5, 8.5, 12.5, 16.5, 20.5, 24.5, 28.5]) {
      const snapshot = sampleForms(INITIAL_FORMS, { seconds });
      expect(validateFormsSnapshot(snapshot)).toEqual([]);
      expect(observeForms(snapshot)).toMatchObject({ finite: true, uniqueIds: 18000, logicalGrains: 19600, drawnGrains: 19600, parts: [3000, 3000, 3000, 3000, 3000, 3000] });
    }
    for (const target of Object.values(FORM_TARGETS)) expect(target.every((point, id) => point.part === Math.floor(id / 3000))).toBe(true);
  });

  it("returns every seed position and normal exactly, with static ground dressing", () => {
    const first = sampleForms(INITIAL_FORMS, { seconds: 4.5 });
    const last = sampleForms(INITIAL_FORMS, { seconds: 28.5 });
    expect(last.grains).toEqual(first.grains);
    expect(last.ground).toEqual(first.ground);
    expect(observeForms(last).returnedSeed).toBe(true);
    expect(first.grains.every(grain => grain.id < 18000)).toBe(true);
    expect(first.ground.every(grain => grain.id.startsWith("ground-"))).toBe(true);
  });

  it("uses endpoint-continuous transport with zero endpoint velocity", () => {
    const a = { x: -100, y: 3, z: 14 }, b = { x: 130, y: 290, z: -86 };
    expect(quintic(0)).toBe(0); expect(quintic(1)).toBe(1);
    expect(transportPosition(a, b, 0, 7720)).toEqual(a);
    expect(transportPosition(a, b, 1, 7720)).toEqual(b);
    const epsilon = 1e-6;
    const nearA = transportPosition(a, b, epsilon, 7720), nearB = transportPosition(a, b, 1 - epsilon, 7720);
    expect(Math.hypot(nearA.x-a.x, nearA.y-a.y, nearA.z-a.z) / epsilon).toBeLessThan(.001);
    expect(Math.hypot(nearB.x-b.x, nearB.y-b.y, nearB.z-b.z) / epsilon).toBeLessThan(.001);
  });

  it("reproduces shuffled seeking without a hidden bed between forms", () => {
    const seedTree = sampleForms(INITIAL_FORMS, { seconds: 8.5 });
    for (const seconds of [30, 14, 0, 20.5, 3, 24.5]) sampleForms(INITIAL_FORMS, { seconds });
    expect(sampleForms(INITIAL_FORMS, { seconds: 8.5 })).toEqual(seedTree);
    expect(sampleForms(INITIAL_FORMS, { seconds: 16.5 }).from).toBe("tree");
    expect(sampleForms(INITIAL_FORMS, { seconds: 16.5 }).to).toBe("citadel");
    expect(sampleForms(INITIAL_FORMS, { seconds: 24.5 }).from).toBe("citadel");
    expect(sampleForms(INITIAL_FORMS, { seconds: 24.5 }).to).toBe("seed");
  });

  it("protects twelve followed identities and silhouette grains in Reduced", () => {
    const full = sampleForms(INITIAL_FORMS, { seconds: 16.5 });
    const reduced = sampleForms({ ...INITIAL_FORMS, fidelity: "reduced", followGrains: true }, { seconds: 16.5 });
    expect(reduced.logicalGrains).toBe(19600);
    expect(reduced.grains).toHaveLength(18000);
    expect(reduced.drawnGrains).toBeLessThan(full.drawnGrains);
    expect(reduced.drawnGrains).toBeGreaterThan(9800);
    expect(FOLLOWED_IDS.every(id => reduced.grains[id]?.drawn)).toBe(true);
    expect(reduced.grains.every((grain, id) => grain.x === full.grains[id]!.x && grain.y === full.grains[id]!.y && grain.z === full.grains[id]!.z)).toBe(true);
    expect(reduced.grains.every(grain => !grain.protected || grain.drawn)).toBe(true);
    expect(observeForms(reduced).followedVisible).toBe(12);
  });

  it("uses settled forms for reduced motion without changing film choreography", () => {
    expect(sampleForms({ ...INITIAL_FORMS, reducedMotion: true }, { seconds: 8.5 }).seconds).toBe(12.5);
    expect(sampleForms({ ...INITIAL_FORMS, reducedMotion: true }, { seconds: 16.5 }).seconds).toBe(20.5);
    expect(sampleForms({ ...INITIAL_FORMS, live: false, reducedMotion: true }, { seconds: 8.5 }).seconds).toBe(8.5);
  });

  it("rejects part swaps, duplication, and abrupt target switches", () => {
    const snapshot = sampleForms(INITIAL_FORMS, { seconds: 8.5 });
    expect(validateFormsSnapshot({ ...snapshot, grains: snapshot.grains.map((grain, id) => id === 0 ? { ...grain, part: 5 } : grain) })).toContain("semantic-part");
    expect(validateFormsSnapshot({ ...snapshot, grains: snapshot.grains.map((grain, id) => id === 1 ? { ...grain, id: 0 } : grain) })).toContain("transport-population");
    const abrupt = { ...snapshot, grains: snapshot.grains.map(grain => ({ ...grain, x: FORM_TARGETS.tree[grain.id]!.x, y: FORM_TARGETS.tree[grain.id]!.y, z: FORM_TARGETS.tree[grain.id]!.z })) };
    expect(validateFormsSnapshot(abrupt)).toContain("continuous-pose");
  });

  it("keeps all actual morphs inside world and 4K movement budgets", () => {
    const report = measureFormsTransport();
    expect(report.totalFrames).toBe(900);
    for (const transition of report.transitions) {
      const actual = transition.semanticParts;
      expect(actual.partMismatch).toBe(0);
      expect(actual.endpointWorld.p95).toBeLessThanOrEqual(338);
      expect(actual.endpointWorld.p99).toBeLessThanOrEqual(442);
      expect(actual.endpointWorld.max).toBeLessThanOrEqual(520);
      expect(actual.peakStep4K.p95).toBeLessThanOrEqual(12);
      expect(actual.peakStep4K.p99).toBeLessThanOrEqual(18);
      expect(actual.peakStep4K.max).toBeLessThanOrEqual(24);
      expect(actual.longestIds).toHaveLength(20);
      expect(actual.pathWorld.median).toBeGreaterThanOrEqual(actual.endpointWorld.median);
      expect(transition.globalMorton.partMismatch).toBeGreaterThan(0);
      // Baseline uses the same point populations and timing. Report both;
      // a lower median is not asserted as a universal semantic-matching win.
      expect(transition.globalMorton.longestIds).toHaveLength(20);
    }
  }, 30_000);

  it("exports bounded score cues and rejects nonfinite authored time", () => {
    expect(FORMS_SOUND_CUES.map(cue => cue.at)).toEqual([.5, 3, 6, 11, 14, 19, 22, 27]);
    expect(FORMS_SOUND_CUES.every(cue => cue.at + cue.duration <= 30)).toBe(true);
    expect(() => sampleForms(INITIAL_FORMS, { seconds: NaN })).toThrow();
    expect(sampleForms(INITIAL_FORMS, { seconds: -3 }).seconds).toBe(0);
    expect(sampleForms(INITIAL_FORMS, { seconds: 33 }).seconds).toBe(30);
  });
});
