import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  INITIAL_ATLAS, sampleAtlas, observeAtlas, atlasHeroPose, atlasCameraClearance,
  atlasOverhead, atlasTimeForRouteProgress,
  atlasCaptionAt,
  atlasRouteYawRate,
} from "./model";
import { ATLAS_GRAINS, ATLAS_MASSES, ATLAS_POPULATION, ATLAS_BASIN_CONTOUR, atlasBasinContains, atlasFutureCoast } from "./world";
import { ATLAS_ROUTE, ATLAS_TURNS, ATLAS_ROUTE_LENGTH, atlasMinimapPoint, routeSampler } from "./route";
import { projectAtlas, atlasBoxFaces, atlasFacadeCoverage } from "./projection";
import { renderAtlas } from "./paint";
import review from "./aster-basin.review";

const at = (seconds: number) => sampleAtlas({ ...INITIAL_ATLAS, live: false, logicalSeconds: seconds });
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("Aster Basin's one world and one route", () => {
  it("underpaints roofs while leaving vertical façade matte area exactly zero", () => {
    for (const seconds of [5.8, 12.8, 17.9, 19.1, 23.9, 25.6, 35, 41.5]) {
      const projection = projectAtlas(at(seconds), 3840, 2160);
      expect(projection.matteFacadeArea).toBe(0);
      expect(projection.facadeMatteCoverage).toBe(0);
    }
    const mass = at(12.8).masses[0]!, faces = atlasBoxFaces(mass);
    expect(atlasFacadeCoverage(faces, faces.filter(face => face.normal.y > 0)).facadeMatteCoverage).toBe(0);
    const faulty = atlasFacadeCoverage(faces, faces);
    expect(faulty.facadeMatteCoverage).toBe(1);
    expect(faulty.matteFacadeArea).toBeCloseTo(2 * (mass.width + mass.depth) * mass.height, 8);
    expect(faulty.facadeMatteCoverage).toBeGreaterThan(.25);
  });
  it("bounds native30fps route yaw while rejecting the original sharp-gaze fixture", () => {
    const rates: number[] = [], sharpRates: number[] = [];
    const yaw = (seconds: number) => { const camera = atlasHeroPose(seconds).camera; return Math.atan2(camera.target.x - camera.eye.x, camera.target.z - camera.eye.z); };
    const sharp = (seconds: number) => { const route = routeSampler(atlasHeroPose(seconds).routeProgress); return Math.atan2(route.ahead.x - route.point.x, route.ahead.z - route.point.z); };
    const rate = (a: number, b: number, clock: (seconds: number) => number) => Math.abs(Math.atan2(Math.sin(clock(b) - clock(a)), Math.cos(clock(b) - clock(a)))) / (b - a) * 180 / Math.PI;
    for (let frame = 480; frame < 750; frame++) {
      const a = frame / 1499 * 50, b = (frame + 1) / 1499 * 50;
      rates.push(rate(a, b, yaw)); sharpRates.push(rate(a, b, sharp));
      expect(atlasRouteYawRate(atlasHeroPose(a).routeProgress)).toBeLessThanOrEqual(60.000001);
    }
    expect(Math.max(...rates)).toBeLessThanOrEqual(60.000001);
    expect(Math.max(...sharpRates)).toBeGreaterThan(200);
  });
  it("holds every teaching caption for its word-count reading floor", () => {
    const holds: { text: string; frames: number }[] = [];
    let last = "";
    for (let frame = 0; frame < 1500; frame++) {
      const text = atlasCaptionAt(frame / 1499 * 50);
      if (!text) { last = ""; continue; }
      if (text !== last) holds.push({ text, frames: 0 });
      holds.at(-1)!.frames++;
      last = text;
    }
    expect(holds).toHaveLength(9);
    for (const hold of holds) {
      const words = hold.text.trim().split(/\s+/).length;
      expect(words, hold.text).toBeLessThanOrEqual(10);
      expect(hold.frames / 30, hold.text).toBeGreaterThanOrEqual(Math.max(0.8, words / 3));
    }
    expect(atlasCaptionAt(40.5)).toBe("Slate recalls the other imagined shoreline.");
    const teaching = sampleAtlas({ ...INITIAL_ATLAS, live: false, logicalSeconds: 40.5, teaching: true });
    expect(teaching.caption).toBe(atlasCaptionAt(teaching.pose.seconds));
  });
  it("gives land, water, and both futures one geographic baseline", () => {
    const present = at(12.8), raised = at(35), open = at(41);
    expect(observeAtlas(present).geography).toEqual({ tideGrains: 800, landGrains: 1000, waterGrains: 200, classified: true, causewayCrosses: true, baselineVertices: 20, terracedMasses: 4 });
    expect(atlasFutureCoast(0, 0).map(({ x, z }) => ({ x, z }))).toEqual(ATLAS_BASIN_CONTOUR);
    const coastline = (snapshot: typeof present) => snapshot.particles.filter(particle => particle.grain.bedRegion === "tide");
    const presentRidge = coastline(present), raisedRidge = coastline(raised), openRidge = coastline(open);
    for (let i = 0; i < 800; i++) {
      const p = presentRidge[i]!, r = raisedRidge[i]!, o = openRidge[i]!;
      expect(r.grain.id).toBe(p.grain.id);
      expect(o.grain.id).toBe(p.grain.id);
      expect(Math.hypot(r.x, r.z + 20) - Math.hypot(p.x, p.z + 20)).toBeCloseTo(30, 8);
      expect(Math.hypot(p.x, p.z + 20) - Math.hypot(o.x, o.z + 20)).toBeCloseTo(24, 8);
    }
    const land = present.particles.find(particle => particle.grain.bedRegion === "land")!;
    const corrupt = { ...present, particles: present.particles.map(particle => particle === land ? { ...particle, x: 360, z: 360 } : particle) };
    expect(atlasBasinContains({ x: 360, z: 360 })).toBe(false);
    expect(observeAtlas(corrupt).geography.classified).toBe(false);
    const street = at(18), ground = projectAtlas(street, 3840, 2160).projectPolygon(atlasFutureCoast(0, 0));
    expect(ground.length).toBeGreaterThan(2);
    expect(ground.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });
  it("conserves the exact 20k architecture,2kbed,2kroute population", () => {
    expect(ATLAS_GRAINS).toHaveLength(24_000);
    expect(new Set(ATLAS_GRAINS.map(grain => grain.id)).size).toBe(24_000);
    for (const [role, count] of Object.entries(ATLAS_POPULATION)) {
      if (role !== "total") expect(ATLAS_GRAINS.filter(grain => grain.role === role)).toHaveLength(count);
    }
    expect(ATLAS_MASSES.filter(mass => !mass.landmark)).toHaveLength(12);
    expect(ATLAS_MASSES.filter(mass => mass.landmark)).toHaveLength(3);
    const canonicalIds = ATLAS_GRAINS.map(grain => grain.id);
    for (const seconds of [0, 5.8, 9.8, 12.8, 18, 28.2, 35, 41, 44.5, 48.5]) {
      const sample = at(seconds);
      expect(sample.particles.map(particle => particle.grain.id)).toEqual(canonicalIds);
      expect(sample.particles.every(particle => [particle.x, particle.y, particle.z].every(Number.isFinite))).toBe(true);
    }
  });

  it("retains every route and landmark grain in Reduced", () => {
    const full = sampleAtlas(INITIAL_ATLAS), reduced = sampleAtlas({ ...INITIAL_ATLAS, fidelity: "reduced" });
    expect(reduced.particles).toHaveLength(full.particles.length);
    expect(reduced.drawnParticles).toHaveLength(17_000);
    expect(reduced.drawnParticles.filter(particle => particle.grain.protected)).toHaveLength(10_000);
    expect(reduced.drawnParticles.filter(particle => particle.grain.role === "route")).toHaveLength(2000);
    expect(reduced.drawnParticles.filter(particle => particle.grain.role === "bed")).toHaveLength(1000);
    expect(reduced.drawnParticles.filter(particle => particle.grain.role === "architecture" && !particle.grain.protected)).toHaveLength(6000);
  });

  it("uses the exact authored route, monotonic distance, and one minimap projection", () => {
    expect(ATLAS_ROUTE).toEqual([{ x: 0, z: 190 }, { x: 0, z: 70 }, { x: -96, z: 70 }, { x: -96, z: -96 }, { x: 96, z: -96 }, { x: 96, z: -160 }]);
    expect(ATLAS_TURNS.map(turn => turn.direction)).toEqual(["left", "right", "right", "left"]);
    let previous = -1;
    for (let i = 0; i <= 100; i++) {
      const progress = i / 100;
      const sample = sampleAtlas({ ...INITIAL_ATLAS, focus: "route", routeProgress: progress });
      expect(sample.navigation.distance).toBeGreaterThan(previous);
      previous = sample.navigation.distance;
      expect(sample.minimapPosition).toEqual(atlasMinimapPoint(routeSampler(progress).point));
      expect(atlasCameraClearance(sample)).toBeGreaterThanOrEqual(6);
    }
    expect(previous).toBe(ATLAS_ROUTE_LENGTH);
    expect(routeSampler(1).point).toEqual({ x: 96, z: -160 });
    expect(routeSampler(1).nextTurn).toBe("arrived");
  });

  it("keeps architecture and route projected through all four turns and the lift", () => {
    for (const turn of ATLAS_TURNS) {
      const sample = at(atlasTimeForRouteProgress(turn.progress));
      const projection = projectAtlas(sample, 3840, 2160);
      expect(projection.finite).toBe(true);
      expect(projection.observation.projectedRoute).toBeGreaterThanOrEqual(20);
      expect(projection.observation.projectedArchitecture).toBeGreaterThanOrEqual(250);
      expect(projection.matteOpacity).toBeLessThanOrEqual(0.25);
      for (const offset of [-0.25, 0.25]) {
        const through = projectAtlas(at(atlasTimeForRouteProgress(turn.progress) + offset), 3840, 2160);
        expect(through.observation.projectedRoute).toBeGreaterThanOrEqual(35);
      }
    }
    const lift = projectAtlas(at(27.7), 3840, 2160);
    expect(lift.observation.projectedArchitecture).toBeGreaterThanOrEqual(100);
    expect(lift.observation.projectedRoofs).toBeGreaterThanOrEqual(100);
    for (let seconds = 13; seconds <= 30; seconds += 0.25) expect(atlasCameraClearance(at(seconds))).toBeGreaterThanOrEqual(6);
  });

  it("locks the future camera and returns to Present before each alternative", () => {
    expect(atlasHeroPose(35).camera).toEqual(atlasHeroPose(41).camera);
    expect(atlasHeroPose(37).raised).toBe(0);
    expect(atlasHeroPose(37).open).toBe(0);
    expect(atlasHeroPose(37).era).toBe(2);
    expect(atlasHeroPose(1110 / 1499 * 50).open).toBe(0);
    expect(atlasHeroPose(41).raisedGhost).toBe(1);
    for (let seconds = 30; seconds <= 47; seconds += 0.1) {
      const pose = atlasHeroPose(seconds);
      expect(pose.raised === 0 || pose.open === 0).toBe(true);
      if (pose.unmake > 0) expect(pose.raised + pose.open).toBe(0);
    }
    expect(atlasHeroPose(42.6).open).toBe(0);
    expect(atlasHeroPose(42.6).unmake).toBe(0);
  });

  it("settles architecture while preserving the cyan route and landmark traces", () => {
    const sample = at(48.5), observed = observeAtlas(sample);
    expect(observed.grains.maximumHeight).toBeLessThanOrEqual(2);
    expect(observed.grains.projectedRoute).toBeGreaterThanOrEqual(1000);
    expect(observed.grains.projectedLandmarks).toBeGreaterThanOrEqual(6000);
    expect(sample.particles.filter(particle => particle.grain.role === "route").every(particle => particle.y === 0.9)).toBe(true);
    expect(sample.particles.filter(particle => particle.grain.protected && particle.grain.role === "architecture").every(particle => particle.x === particle.grain.trace.x && particle.z === particle.grain.trace.z)).toBe(true);
    expect(projectAtlas(atlasOverhead(sample), 1280, 720).finite).toBe(true);
  });

  it("rejects blocked corridors, empty sky, inconsistent maps, and vanishing traces", () => {
    const street = sampleAtlas({ ...INITIAL_ATLAS, focus: "route", routeProgress: 0.5 });
    const blocker = { ...street.masses[0]!, x: street.camera.eye.x, z: street.camera.eye.z, width: 48, depth: 48, height: street.camera.eye.y + 16, presence: 1 };
    expect(observeAtlas({ ...street, masses: [blocker, ...street.masses.slice(1)] }).camera.insideMass).toBe(true);
    const sky = { ...street, camera: { eye: street.camera.eye, target: { x: street.camera.eye.x, y: 1000, z: street.camera.eye.z - 1 } } };
    expect(observeAtlas(sky).camera.finite).toBe(true);
    expect(observeAtlas(sky).grains.projectedArchitecture).toBeLessThan(100);
    const turn = at(atlasTimeForRouteProgress(ATLAS_TURNS[3]!.progress));
    const n = turn.navigation;
    const tooDistant = { ...turn, camera: { eye: { ...turn.camera.eye, y: 32 }, focalScale: 0.74, target: { x: n.point.x + (n.ahead.x - n.point.x) * 3, y: 18, z: n.point.z + (n.ahead.z - n.point.z) * 3 } } };
    expect(projectAtlas(tooDistant, 3840, 2160).observation.projectedRoute).toBeLessThan(60);
    expect(observeAtlas({ ...street, minimapPosition: { x: street.minimapPosition.x + 10, y: street.minimapPosition.y } }).minimap.sameRoute).toBe(false);
    const final = at(48.5);
    expect(observeAtlas({ ...final, pose: { ...final.pose, routeAlpha: 0 } }).grains.projectedRoute).toBe(0);
    expect(observeAtlas({ ...final, pose: { ...final.pose, raised: 0.5, open: 0.5 } }).future.exclusive).toBe(false);
  });

  it("reproduces rendered geometry after shuffled seeks and keeps teaching choreography identical", () => {
    const times = [5.8, 12.8, 18, 28.2, 35, 37, 41, 48.5];
    const sampleDigest = (seconds: number) => {
      const snapshot = at(seconds), projection = projectAtlas(snapshot, 1280, 720);
      return digest({ paint: renderAtlas(snapshot, { width: 1280, height: 720, projection }), observation: observeAtlas(snapshot, projection) });
    };
    const expected = new Map(times.map(seconds => [seconds, sampleDigest(seconds)]));
    for (const seconds of [48.5, 18, 37, 5.8, 41, 12.8, 35, 28.2, 18]) expect(sampleDigest(seconds)).toBe(expected.get(seconds));
    const clean = at(18), teaching = sampleAtlas({ ...INITIAL_ATLAS, live: false, logicalSeconds: 18, teaching: true });
    expect(teaching.caption.split(" ").length).toBeLessThanOrEqual(10);
    expect(teaching.pose).toEqual(clean.pose);
    expect(projectAtlas(teaching, 1280, 720).grainPaths).toEqual(projectAtlas(clean, 1280, 720).grainPaths);
    expect(teaching.particles).toEqual(clean.particles);
  });

  it("passes the exact observations authored for the review packet", () => {
    expect(review.beats).toHaveLength(21);
    const clipSeconds = review.beats.reduce((sum, beat) => "range" in beat && beat.range ? sum + parseFloat(beat.range[1]) - parseFloat(beat.range[0]) : sum, 0);
    expect(clipSeconds).toBeLessThanOrEqual(8);
    for (const beat of review.beats) {
      const seconds = parseFloat(beat.at);
      const snapshot = at(seconds), observation = observeAtlas(snapshot, projectAtlas(snapshot, 3840, 2160));
      for (const check of review.checks.filter(check => !("beat" in check) || check.beat === beat.id)) {
        let value: unknown = observation;
        for (const key of check.metric.split(".")) value = (value as Record<string, unknown>)[key];
        if ("equals" in check) expect(value, `${beat.id}:${check.id}`).toBe(check.equals);
        if ("min" in check) expect(value, `${beat.id}:${check.id}`).toBeGreaterThanOrEqual(check.min!);
        if ("max" in check) expect(value, `${beat.id}:${check.id}`).toBeLessThanOrEqual(check.max!);
      }
    }
  });
});
