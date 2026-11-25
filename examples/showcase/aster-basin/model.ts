import { ATLAS_GRAINS, ATLAS_MASSES, ATLAS_POPULATION, ATLAS_SEED, atlasCoastPoint, atlasBasinContains, ATLAS_BASIN_CONTOUR, type AtlasGrain, type AtlasMass, type Vec3 } from "./world";
import { ATLAS_ROUTE_LENGTH, ATLAS_TURNS, routeSampler, atlasMinimapPoint } from "./route";
import { projectAtlas, type AtlasProjection } from "./projection";
import { createSmoothedAtlasHeading } from "./camera-heading";
export { routeSampler } from "./route";

export type AtlasFuture = "present" | "raised" | "open";
export type AtlasFocus = "overview" | "route" | "causeway" | "cistern" | "archive";
export interface AtlasInput {
  live: boolean;
  logicalSeconds: number;
  era: number;
  future: AtlasFuture;
  routeProgress: number;
  unmake: number;
  focus: AtlasFocus;
  fidelity: "full" | "reduced";
  teaching: boolean;
  inputVersion: number;
  reducedMotion: boolean;
}
export const INITIAL_ATLAS: Readonly<AtlasInput> = Object.freeze({
  live: true, logicalSeconds: 0, era: 2, future: "present", routeProgress: 0,
  unmake: 0, focus: "overview", fidelity: "full", teaching: false, inputVersion: 0, reducedMotion: false,
});
export interface AtlasCamera { readonly eye: Vec3; readonly target: Vec3; readonly focalScale?: number }
export interface AtlasPose {
  readonly seconds: number;
  readonly era: number;
  readonly assembly: number;
  readonly raised: number;
  readonly open: number;
  readonly unmake: number;
  readonly routeProgress: number;
  readonly routeAlpha: number;
  readonly raisedGhost: number;
  readonly camera: AtlasCamera;
  readonly focus: AtlasFocus;
  readonly futureLabel: string;
}
export interface AtlasParticle extends Vec3 {
  readonly grain: AtlasGrain;
  readonly structural: number;
  readonly normal: Vec3;
  readonly tone: number;
}
export interface AtlasMassPose {
  readonly mass: AtlasMass;
  readonly index: number;
  readonly x: number; readonly z: number;
  readonly width: number; readonly depth: number; readonly height: number;
  readonly presence: number;
}
export interface AtlasSnapshot {
  readonly input: Readonly<AtlasInput>;
  readonly pose: AtlasPose;
  readonly particles: readonly AtlasParticle[];
  readonly drawnParticles: readonly AtlasParticle[];
  readonly masses: readonly AtlasMassPose[];
  readonly camera: AtlasCamera;
  readonly navigation: ReturnType<typeof routeSampler>;
  readonly minimapPosition: Readonly<{ x: number; y: number }>;
  readonly caption: string;
}
export const atlasClamp = (p: number) => Math.max(0, Math.min(1, p));
export const atlasMix = (a: number, b: number, p: number) => a + (b - a) * p;
export const atlasSmooth = (p: number) => { const q = atlasClamp(p); return q * q * q * (q * (q * 6 - 15) + 10); };
const during = (seconds: number, start: number, end: number) => atlasSmooth((seconds - start) / (end - start));
const TAU = Math.PI * 2;
export const ATLAS_OVERVIEW: AtlasCamera = Object.freeze({
  eye: Object.freeze({ x: 460, y: 580, z: 620 }), target: Object.freeze({ x: 0, y: 20, z: 0 }),
});
function mixVector(a: Vec3, b: Vec3, p: number): Vec3 {
  return { x: atlasMix(a.x, b.x, p), y: atlasMix(a.y, b.y, p), z: atlasMix(a.z, b.z, p) };
}
function mixCamera(a: AtlasCamera, b: AtlasCamera, p: number): AtlasCamera {
  return { eye: mixVector(a.eye, b.eye, p), target: mixVector(a.target, b.target, p), focalScale: atlasMix(a.focalScale ?? 0.74, b.focalScale ?? 0.74, p) };
}
export function atlasStreetCamera(progress: number): AtlasCamera {
  const route = routeSampler(progress);
  const bendDistance = Math.min(...ATLAS_TURNS.map(turn => Math.abs(turn.distance - route.distance)));
  const bend = atlasSmooth((52 - bendDistance) / 20);
  const lift = atlasSmooth((100 - bendDistance) / 60);
  const gaze = 3 - bend * 1.4;
  const angle = smoothedRouteHeading(atlasTimeForRouteProgress(progress));
  const distance = Math.hypot(route.ahead.x - route.point.x, route.ahead.z - route.point.z) * gaze;
  // The same 22-unit sample guides both gazes: a longer view on straight
  // streets reads facades; a closer view through corners retains the curve.
  return {
    eye: { ...route.point, y: 32 + lift * 96 },
    focalScale: 0.74 - lift * 0.26,
    target: { x: route.point.x + Math.sin(angle) * distance, y: 18 - bend * 2, z: route.point.z + Math.cos(angle) * distance },
  };
}
export function atlasTravelProgress(seconds: number): number {
  const t = atlasClamp((seconds - 16) / 9);
  return atlasClamp((t < 0.06 ? t * t / 0.12 : t > 0.94 ? 0.94 - (1 - t) ** 2 / 0.12 : t - 0.03) / 0.94);
}
export function atlasTimeForRouteProgress(progress: number): number {
  let low = 16, high = 25;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (atlasTravelProgress(middle) < progress) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
const smoothedRouteHeading = createSmoothedAtlasHeading(atlasTravelProgress);
export function atlasRouteYawRate(progress: number): number {
  const seconds = atlasTimeForRouteProgress(progress), halfStep = 1 / 480;
  return Math.abs(smoothedRouteHeading(seconds + halfStep) - smoothedRouteHeading(seconds - halfStep)) / (halfStep * 2) * 180 / Math.PI;
}

/** A vertical descent/rise inside open space precedes any low lateral move. */
function heroCamera(seconds: number, routeProgress: number): AtlasCamera {
  const first = atlasStreetCamera(0), last = atlasStreetCamera(1);
  if (seconds < 13) return ATLAS_OVERVIEW;
  if (seconds < 14) return mixCamera(ATLAS_OVERVIEW, { eye: { ...first.eye, y: 580 }, target: first.target }, during(seconds, 13, 14));
  if (seconds < 16) return mixCamera({ eye: { ...first.eye, y: 580 }, target: first.target }, first, during(seconds, 14, 16));
  if (seconds < 27) return atlasStreetCamera(routeProgress);
  const risen: AtlasCamera = { eye: { ...last.eye, y: 580 }, target: ATLAS_OVERVIEW.target };
  if (seconds < 28.7) return mixCamera(last, risen, during(seconds, 27, 28.7));
  if (seconds < 30) return mixCamera(risen, ATLAS_OVERVIEW, during(seconds, 28.7, 30));
  return ATLAS_OVERVIEW;
}

/** The two imagined futures are alternatives, each starting from Present. */
export function atlasHeroPose(seconds: number): AtlasPose {
  const s = Math.max(0, Math.min(50, seconds));
  const assembly = during(s, 2, 6);
  const era = s < 10 ? during(s, 6, 10) : 1 + during(s, 10, 13);
  const routeProgress = atlasTravelProgress(s);
  const raised = during(s, 30, 34) * (1 - during(s, 36, 37));
  // Keep the baseline for one complete 30 fps frame. Inclusive scene clocks
  // sample frame 1110 just after 37 s, rather than at the boundary itself.
  const open = during(s, 37 + 1 / 30, 40) * (1 - during(s, 42, 42.6));
  const unmake = during(s, 42.6, 47);
  const raisedGhost = during(s, 39.7, 40) * (1 - during(s, 42, 42.6));
  return Object.freeze({
    seconds: s, era, assembly, raised, open, unmake, routeProgress,
    routeAlpha: during(s, 10, 13), raisedGhost,
    camera: heroCamera(s, routeProgress), focus: s >= 13 && s < 30 ? "route" : "overview",
    futureLabel: raised > 0.001 ? "Imagined future: Raised Shore" : open > 0.001 ? "Imagined future: Open Shore" : "",
  });
}

function landmarkCamera(focus: AtlasFocus): AtlasCamera {
  const mass = ATLAS_MASSES.find(candidate => candidate.landmark === focus);
  if (!mass) return ATLAS_OVERVIEW;
  return { eye: { x: mass.x + 150, y: 180, z: mass.z + 190 }, target: { x: mass.x, y: mass.height * 0.35, z: mass.z } };
}
function livePose(input: Readonly<AtlasInput>): AtlasPose {
  const era = Math.max(0, Math.min(2, input.era));
  const raised = input.future === "raised" ? 1 : 0, open = input.future === "open" ? 1 : 0;
  const futureLabel = raised ? "Imagined future: Raised Shore" : open ? "Imagined future: Open Shore" : "";
  return {
    seconds: input.logicalSeconds, era, assembly: 1, raised, open,
    unmake: atlasClamp(input.unmake), routeProgress: atlasClamp(input.routeProgress),
    routeAlpha: atlasSmooth(era - 1), raisedGhost: 0,
    focus: input.focus, futureLabel,
    camera: input.focus === "route" ? atlasStreetCamera(input.routeProgress) : landmarkCamera(input.focus),
  };
}

function massPose(mass: AtlasMass, index: number, pose: AtlasPose): AtlasMassPose {
  const eraPresence = mass.firstEra === 0 ? 1 : atlasSmooth(pose.era - (mass.firstEra - 1));
  const heightScale = 0.42 + 0.58 * atlasClamp(pose.era / 2);
  const futureEligible = mass.landmark ? 0 : 1;
  const raised = pose.raised * futureEligible, open = pose.open * futureEligible;
  const radial = Math.hypot(mass.x, mass.z + 20);
  return {
    mass, index,
    // Keep each district near its present footprint; the coast carries the
    // speculative perimeter change, instead of scattering the interior city.
    x: mass.x + mass.x / radial * (raised * 20 - open * 10),
    z: mass.z + (mass.z + 20) / radial * (raised * 20 - open * 10),
    width: mass.width * (1 + raised * 0.08 - open * 0.28),
    depth: mass.depth * (1 + raised * 0.08 - open * 0.28),
    height: mass.height * heightScale * (1 + raised * 0.16 - open * 0.42) + raised * 18,
    presence: eraPresence * pose.assembly,
  };
}

export function atlasCaptionAt(seconds: number): string {
  if (seconds >= 3 && seconds < 6) return "A first quay gathers from the bed.";
  if (seconds >= 7 && seconds < 10) return "The port grows around its water.";
  if (seconds >= 10.3 && seconds < 13) return "Present terraces retain the earlier landmarks.";
  if (seconds >= 16 && seconds < 20) return "One route drives the street view and map.";
  if (seconds >= 27 && seconds < 30) return "Rise clear of roofs before moving sideways.";
  if (seconds >= 34 && seconds < 37) return "Each imagined future starts from the same present.";
  if (seconds >= 40 && seconds < 42.6) return "Slate recalls the other imagined shoreline.";
  if (seconds >= 44 && seconds < 47) return "Present architecture returns to its constituent grains.";
  if (seconds >= 47) return "Route and landmarks remain as traces.";
  return "";
}

export function sampleAtlas(input: Readonly<AtlasInput>): AtlasSnapshot {
  const frozenInput = Object.freeze({ ...input });
  const pose = input.live ? livePose(input) : atlasHeroPose(input.logicalSeconds);
  const masses = ATLAS_MASSES.map((mass, index) => massPose(mass, index, pose));
  const particles = ATLAS_GRAINS.map((grain): AtlasParticle => {
    if (grain.role === "bed") {
      const point = grain.bedRegion === "tide" ? atlasCoastPoint(grain.coastPhase!, pose.raised * 30 - pose.open * 24 + (grain.sparkle - 0.5) * 3.8) : grain.bed;
      const tone = grain.bedRegion === "tide" ? 18 + Math.floor(grain.seed * 2) : grain.bedRegion === "land" ? 16 + Math.floor(grain.seed * 2) : 20 + Math.floor(grain.seed * 2);
      return { ...point, grain, structural: 0, normal: grain.normal, tone };
    }
    if (grain.role === "route") {
      const lead = grain.routeDistance - pose.routeProgress * ATLAS_ROUTE_LENGTH;
      return { ...grain.local, grain, structural: 0, normal: grain.normal, tone: lead < -8 ? 13 : grain.seed > 0.7 ? 15 : 14 };
    }
    const mass = masses[grain.mass]!;
    const arrive = atlasSmooth((mass.presence - grain.seed * 0.13) / 0.87);
    const depart = atlasSmooth((pose.unmake - (1 - grain.local.y) * 0.2 - grain.seed * 0.12) / 0.68);
    const held = arrive * (1 - depart);
    const target = { x: mass.x + grain.local.x * mass.width, y: grain.local.y * mass.height, z: mass.z + grain.local.z * mass.depth };
    const end = mass.mass.landmark ? grain.trace : { x: grain.bed.x + 36, y: grain.bed.y, z: grain.bed.z + (grain.seed - 0.5) * 24 };
    const source = depart === 1 ? end : {
      x: atlasMix(grain.bed.x, end.x, depart), y: atlasMix(grain.bed.y, end.y, depart), z: atlasMix(grain.bed.z, end.z, depart),
    };
    const flight = Math.sin(held * Math.PI) * (1 - depart);
    const point = held === 0 ? source : {
      x: atlasMix(source.x, target.x, held) + flight * Math.sin(grain.seed * TAU) * 8,
      y: atlasMix(source.y, target.y, held) + flight * (4 + grain.seed * 6),
      z: atlasMix(source.z, target.z, held) + flight * Math.cos(grain.seed * TAU) * 8,
    };
    const diffuse = Math.max(0, grain.normal.x * -0.52 + grain.normal.y * 0.8 + grain.normal.z * 0.34);
    const course = (grain.normal.y === 0 ? 0.09 : 0) * Math.pow(0.5 + 0.5 * Math.cos(point.y / 7 * TAU), 10);
    const light = atlasMix(0.17 + grain.sparkle * 0.18, 0.26 + diffuse * 0.56 + grain.sparkle ** 6 * 0.18 - course, held);
    const tone = Math.min(12, Math.floor(atlasClamp(light + (grain.seed - 0.5) / 13) * 13));
    return { ...point, grain, structural: held, normal: grain.normal, tone };
  });
  const navigation = routeSampler(pose.routeProgress);
  return Object.freeze({
    input: frozenInput, pose, particles,
    drawnParticles: input.fidelity === "reduced" ? particles.filter(particle => particle.grain.reduced) : particles,
    masses, camera: pose.camera, navigation, minimapPosition: atlasMinimapPoint(navigation.point),
    caption: input.teaching ? atlasCaptionAt(pose.seconds) : "",
  });
}

function distanceToMass(point: Vec3, mass: AtlasMassPose): number {
  const halfWidth = mass.width / 2, halfDepth = mass.depth / 2;
  const dx = Math.max(0, Math.abs(point.x - mass.x) - halfWidth);
  const dz = Math.max(0, Math.abs(point.z - mass.z) - halfDepth);
  const dy = point.y < 0 ? -point.y : Math.max(0, point.y - mass.height * mass.presence);
  return Math.hypot(dx, dy, dz);
}
export function atlasCameraClearance(snapshot: AtlasSnapshot, camera: AtlasCamera = snapshot.camera): number {
  return Math.min(Math.max(0, camera.eye.y), ...snapshot.masses.filter(mass => mass.presence > 0.01).map(mass => distanceToMass(camera.eye, mass)));
}

/** Reuse the world in an overhead projection without inventing another city. */
export function atlasOverhead(snapshot: AtlasSnapshot): AtlasSnapshot {
  return { ...snapshot, camera: { eye: { x: 0, y: 850, z: 0 }, target: { x: 0, y: 0, z: 0 } } };
}

/** Model and projected geometry facts; none claim captured pixel coverage. */
export function observeAtlas(snapshot: AtlasSnapshot, projection?: AtlasProjection) {
  const projected = projection ?? projectAtlas(snapshot, 1280, 720);
  const camera = snapshot.camera;
  return {
    seed: ATLAS_SEED, inputVersion: snapshot.input.inputVersion, fidelity: snapshot.input.fidelity,
    grains: {
      ...ATLAS_POPULATION, drawn: snapshot.drawnParticles.length,
      protected: snapshot.particles.filter(particle => particle.grain.protected).length,
      maximumHeight: Math.max(...snapshot.particles.filter(particle => particle.grain.role === "architecture").map(particle => particle.y)),
      ...projected.observation,
    },
    camera: { eye: { ...camera.eye }, target: { ...camera.target }, finite: projected.finite, clearance: atlasCameraClearance(snapshot), insideMass: atlasCameraClearance(snapshot) === 0, routeYawRate: atlasRouteYawRate(snapshot.pose.routeProgress) },
    navigation: { ...snapshot.navigation, point: { ...snapshot.navigation.point }, ahead: { ...snapshot.navigation.ahead } },
    minimap: {
      position: { ...snapshot.minimapPosition }, expectedPosition: atlasMinimapPoint(snapshot.navigation.point),
      sameRoute: Math.hypot(snapshot.minimapPosition.x - atlasMinimapPoint(snapshot.navigation.point).x, snapshot.minimapPosition.y - atlasMinimapPoint(snapshot.navigation.point).y) < 0.000001,
    },
    material: { era: snapshot.pose.era, assembly: snapshot.pose.assembly, unmake: snapshot.pose.unmake, matteOpacity: projected.matteOpacity,
      facadeMatteCoverage: projected.facadeMatteCoverage, matteFacadeArea: projected.matteFacadeArea, visibleFacadeArea: projected.visibleFacadeArea },
    geography: {
      tideGrains: snapshot.particles.filter(particle => particle.grain.bedRegion === "tide").length,
      landGrains: snapshot.particles.filter(particle => particle.grain.bedRegion === "land").length,
      waterGrains: snapshot.particles.filter(particle => particle.grain.bedRegion === "water").length,
      classified: snapshot.particles.filter(particle => particle.grain.bedRegion === "land" || particle.grain.bedRegion === "water").every(particle => atlasBasinContains(particle) === (particle.grain.bedRegion === "land")),
      causewayCrosses: atlasBasinContains({ x: 0, z: 197 }) && !atlasBasinContains({ x: 0, z: 271 }),
      baselineVertices: ATLAS_BASIN_CONTOUR.length,
      terracedMasses: snapshot.masses.filter(mass => mass.mass.terrace && mass.presence > 0.98).length,
    },
    future: {
      raised: snapshot.pose.raised, open: snapshot.pose.open, present: 1 - snapshot.pose.raised - snapshot.pose.open,
      raisedGhost: snapshot.pose.raisedGhost, label: snapshot.pose.futureLabel,
      exclusive: !(snapshot.pose.raised > 0.000001 && snapshot.pose.open > 0.000001),
    },
    traces: { routeAlpha: snapshot.pose.routeAlpha, landmarkCount: 3, authorReported: true },
  };
}

export const ATLAS_SOUND_CUES = Object.freeze([
  { at: 2, kind: "resonant-grain-rise", duration: 4 },
  { at: 6, kind: "port-resonance", duration: 4 },
  { at: 16, kind: "route-current", duration: 9 },
  { at: 25, kind: "modal-buoy", duration: 2 },
  { at: 30, kind: "raised-resonance", duration: 6 },
  { at: 37, kind: "open-resonance", duration: 5 },
  { at: 42.6, kind: "erosion", duration: 4.4 },
]);
