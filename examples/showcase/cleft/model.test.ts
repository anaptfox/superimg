import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CLEFT_GRAINS, CLEFT_GRAIN_COUNT, CLEFT_PATHS, CLEFT_LOOP_FRAMES, INITIAL_CLEFT,
  insidePolygon, cleftLoopPhase, cleftGrainLight, sampleCleft, observeCleft,
} from "./model";
import { cleftFacetBatches, renderCleft } from "./paint";
import type { MediaElement } from "@foxworth/superimg";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const view = { width: 3840, height: 2160, draw: (_path: string, progress: number) => ({ strokeDasharray: "400", strokeDashoffset: String(400 * (1 - progress)) }) };
function findNode(root: MediaElement, id: string): MediaElement | undefined {
  if (root.props.id === id) return root;
  for (const child of root.children) {
    if (child && typeof child === "object" && !Array.isArray(child) && "props" in child && "children" in child) {
      const found = findNode(child as MediaElement, id);
      if (found) return found;
    }
  }
  return undefined;
}

describe("Cleft's conserved mineral identity", () => {
  it("retains exactly 8192 unique grain ids entirely inside their own polygon", () => {
    expect(CLEFT_GRAINS).toHaveLength(CLEFT_GRAIN_COUNT);
    expect(new Set(CLEFT_GRAINS.map(grain => grain.id)).size).toBe(CLEFT_GRAIN_COUNT);
    for (const grain of CLEFT_GRAINS) {
      expect(insidePolygon(grain.x, grain.y, grain.slab)).toBe(true);
      expect(insidePolygon(grain.x, grain.y, grain.slab === 0 ? 1 : 0)).toBe(false);
      expect([grain.x, grain.y, grain.radius, grain.relief].every(Number.isFinite)).toBe(true);
    }
    expect(CLEFT_PATHS).toEqual(["M8 8H92V38H62V62H38V82H8Z", "M92 48H72V72H48V92H8V112H92Z"]);
  });

  it("rejects sample points deposited in the stepped negative-space cut", () => {
    for (const [x, y] of [[80, 43], [67, 56], [54, 67], [43, 78], [20, 87]]) {
      expect(insidePolygon(x!, y!, 0) || insidePolygon(x!, y!, 1)).toBe(false);
    }
    const good = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds: 5 });
    const wrong = { ...good, grains: [{ ...good.grains[0]!, x: 54, y: 67 }, ...good.grains.slice(1)] };
    expect(observeCleft(wrong).gapClear).toBe(false);
  });

  it("halves only unprotected decorative grains and conserves the logical sampler", () => {
    const full = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds: 5 });
    const reduced = sampleCleft({ ...INITIAL_CLEFT, fidelity: "reduced" }, { kind: "hero", seconds: 5 });
    expect(reduced.grains).toBe(full.grains);
    const protectedGrains = full.grains.filter(grain => grain.protected);
    expect(protectedGrains.length).toBeGreaterThan(0);
    expect(reduced.drawnGrains.filter(grain => grain.protected)).toEqual(protectedGrains);
    expect(reduced.drawnGrains.filter(grain => !grain.protected).length).toBe(Math.ceil(full.grains.filter(grain => !grain.protected).length / 2));
    expect(observeCleft(reduced).drawnPopulation).toBe(reduced.drawnGrains.length);
  });

  it("reproduces paint and observations after shuffled seeks", () => {
    const sample = (seconds: number) => {
      const snapshot = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds });
      return digest({ paint: renderCleft(snapshot, view), observation: observeCleft(snapshot) });
    };
    const times = [0, 2.6, 5, 8.5, 12.65, 13.55, 15.3, 18];
    const expected = new Map(times.map(seconds => [seconds, sample(seconds)]));
    for (const seconds of [18, 8.5, 0, 13.55, 2.6, 15.3, 5, 12.65, 8.5]) expect(sample(seconds)).toBe(expected.get(seconds));
  });

  it("keeps material contours and grain identity unchanged across all paints", () => {
    const observed = ["ink", "mineral", "graphite"].map(material => observeCleft(sampleCleft({ ...INITIAL_CLEFT, material: material as "ink" | "mineral" | "graphite" }, { kind: "hero", seconds: 5 })));
    expect(new Set(observed.map(observation => observation.contourIdentity)).size).toBe(1);
    expect(observed.every(observation => observation.logicalPopulation === 8192 && observation.gapClear)).toBe(true);
    for (const seconds of [5, 8.5, 12.65, 13.55, 15.3]) {
      const snapshot = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds });
      expect(Object.values(snapshot.weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
      expect(snapshot.grains).toBe(CLEFT_GRAINS);
      expect(cleftFacetBatches(snapshot)).toHaveLength(128);
    }
  });

  it("loops analytically from encoded frame120 to frame0 without duplicating119", () => {
    const zero = sampleCleft(INITIAL_CLEFT, { kind: "loop", seconds: 0, frame: 0 });
    const last = sampleCleft(INITIAL_CLEFT, { kind: "loop", seconds: 4, frame: 119 });
    const next = sampleCleft(INITIAL_CLEFT, { kind: "loop", seconds: 4, frame: 120 });
    expect(cleftLoopPhase(CLEFT_LOOP_FRAMES)).toBe(0);
    expect(cleftLoopPhase(119)).toBe(119 / 120);
    expect(cleftLoopPhase(-1)).toBe(119 / 120);
    expect(cleftFacetBatches(next)).toEqual(cleftFacetBatches(zero));
    expect(cleftFacetBatches(last)).not.toEqual(cleftFacetBatches(zero));
    const averageDelta = (a: typeof zero, b: typeof zero) => a.grains.reduce((sum, grain) => sum + Math.abs(cleftGrainLight(grain, a) - cleftGrainLight(grain, b)), 0) / 8192;
    const firstStep = sampleCleft(INITIAL_CLEFT, { kind: "loop", seconds: 1 / 30, frame: 1 });
    expect(averageDelta(last, zero)).toBeLessThan(averageDelta(zero, firstStep) * 1.2);
  });

  it("teaching adds captions without changing grain paint or camera", () => {
    const clean = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds: 8.5 });
    const teach = sampleCleft({ ...INITIAL_CLEFT, teaching: true }, { kind: "hero", seconds: 8.5 });
    expect(teach.caption.split(" ").length).toBeLessThanOrEqual(10);
    expect(teach.camera).toEqual(clean.camera);
    expect(teach.reveal).toEqual(clean.reveal);
    expect(cleftFacetBatches(teach)).toEqual(cleftFacetBatches(clean));
  });

  it("lights facet orientation instead of adding random brightness", () => {
    const snapshot = sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds: 5 });
    const grain = snapshot.grains[0]!;
    const facing = { ...grain, facetNx: -.6, facetNy: 0, facetNz: .8 };
    const away = { ...grain, facetNx: .6, facetNy: 0, facetNz: .8 };
    expect(cleftGrainLight(facing, snapshot)).toBeGreaterThan(cleftGrainLight(away, snapshot));
    expect(cleftGrainLight({ ...grain, seed: 0 }, snapshot)).toBe(cleftGrainLight({ ...grain, seed: 1 }, snapshot));
    expect(snapshot.grains.every(g => Math.abs(Math.hypot(g.facetNx, g.facetNy, g.facetNz) - 1) < 1e-12)).toBe(true);
    const tree = renderCleft(snapshot, view);
    for (let i = 0; i < 128; i++) {
      const fill = findNode(tree, `cleft-grains-${i}`)?.props.fill;
      expect(typeof fill).toBe("string");
      const channels = String(fill).match(/\d+/g)!.map(Number);
      expect(Math.min(...channels)).toBeGreaterThanOrEqual(30);
      expect(Math.max(...channels)).toBeLessThanOrEqual(114);
    }
  });

  it("preserves grain geometry and leaves the canonical ink icon free of relief", () => {
    const originalGeometry = CLEFT_GRAINS.map(({ id, slab, x, y, radius, seed, relief, depth, protected: keep, reduced }) => ({ id, slab, x, y, radius, seed, relief, depth, protected: keep, reduced }));
    expect(digest(originalGeometry)).toBe("64003ff462a785cca777b9fc873389cb2e5de30193b4e3acf513bdd3dba5c8f5");
    const mineral = renderCleft(sampleCleft(INITIAL_CLEFT, { kind: "hero", seconds: 5 }), view);
    expect(findNode(mineral, "cleft-relief-edge")).toBeUndefined();
    expect(findNode(mineral, "cleft-gap-relief")?.props.clip).toBe("cleft-negative-cut");
    expect(findNode(mineral, "cleft-cut-highlight")?.props.d).toBe("M92 48H72V72H48V92H8");
    const icon = sampleCleft({ ...INITIAL_CLEFT, material: "ink" }, { kind: "icon", seconds: 0 });
    expect(observeCleft(icon).silhouette.minimumGap).toBe(10);
    const tree = renderCleft(icon, { ...view, width: 64, height: 64, labels: false });
    expect(findNode(tree, "cleft-gap-relief")?.props.opacity).toBe(0);
    expect(findNode(tree, "cleft-cut-highlight")?.props.opacity).toBe(0);
    expect(findNode(tree, "cleft-solid-contours")?.props.d).toBe(CLEFT_PATHS.join(" "));
  });
});
