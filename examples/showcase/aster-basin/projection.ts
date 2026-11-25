import type { AtlasSnapshot, AtlasParticle, AtlasMassPose } from "./model";
import type { Vec3 } from "./world";

export const ATLAS_TONE_COUNT = 22;
const DEPTHS = 16, TONES = ATLAS_TONE_COUNT, MATTE_TONES = 3;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
export interface AtlasProjectedPoint { readonly x: number; readonly y: number; readonly depth: number }
export interface AtlasProjection {
  readonly grainPaths: readonly string[];
  readonly mattePaths: readonly string[];
  readonly matteOpacity: number;
  readonly facadeMatteCoverage: number;
  readonly matteFacadeArea: number;
  readonly visibleFacadeArea: number;
  readonly finite: boolean;
  readonly width: number;
  readonly height: number;
  readonly observation: { projectedArchitecture: number; projectedRoofs: number; projectedRoute: number; projectedLandmarks: number; projectedBed: number };
  readonly project: (point: Vec3, allowOutside?: boolean) => AtlasProjectedPoint | null;
  readonly projectPolygon: (points: readonly Vec3[]) => readonly AtlasProjectedPoint[];
}

function clipPlane(points: readonly Vec3[], axis: keyof Vec3, bound: number, above: boolean): Vec3[] {
  const output: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const aIn = above ? a[axis] >= bound : a[axis] <= bound;
    const bIn = above ? b[axis] >= bound : b[axis] <= bound;
    if (aIn) output.push(a);
    if (aIn !== bIn) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      output.push({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });
    }
  }
  return output;
}
function facet(x: number, y: number, radius: number, seed: number): string {
  const rx = radius * (0.84 + seed * 0.25), ry = radius * (0.72 + seed * 0.34);
  return `M${(x - rx).toFixed(1)},${y.toFixed(1)}l${rx.toFixed(1)},${(-ry).toFixed(1)}l${rx.toFixed(1)},${ry.toFixed(1)}l${(-rx).toFixed(1)},${ry.toFixed(1)}Z`;
}

function occluded(snapshot: AtlasSnapshot, point: AtlasParticle): boolean {
  const eye = snapshot.camera.eye, dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
  for (const mass of snapshot.masses) {
    if (mass.index === point.grain.mass || mass.presence < 0.98 || snapshot.pose.unmake > 0.1) continue;
    let near = 0, far = 0.997;
    const bounds = [[eye.x, dx, mass.x - mass.width / 2, mass.x + mass.width / 2], [eye.y, dy, 0, mass.height], [eye.z, dz, mass.z - mass.depth / 2, mass.z + mass.depth / 2]];
    for (const [origin, delta, low, high] of bounds) {
      if (Math.abs(delta!) < 0.000001) {
        if (origin! < low! || origin! > high!) { far = -1; break; }
      } else {
        const a = (low! - origin!) / delta!, b = (high! - origin!) / delta!;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        if (near > far) break;
      }
    }
    if (near <= far && far > 0.001 && near < 0.997) return true;
  }
  return false;
}

export function atlasBoxFaces(mass: AtlasMassPose, inset = 1, bottom = 0, top = 1) {
  const x0 = mass.x - mass.width * inset / 2, x1 = mass.x + mass.width * inset / 2;
  const z0 = mass.z - mass.depth * inset / 2, z1 = mass.z + mass.depth * inset / 2, y = mass.height * top, b = mass.height * bottom;
  return [
    { normal: { x: 0, y: 0, z: 1 }, points: [{ x: x0, y: b, z: z1 }, { x: x1, y: b, z: z1 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }] },
    { normal: { x: 0, y: 0, z: -1 }, points: [{ x: x1, y: b, z: z0 }, { x: x0, y: b, z: z0 }, { x: x0, y, z: z0 }, { x: x1, y, z: z0 }] },
    { normal: { x: 1, y: 0, z: 0 }, points: [{ x: x1, y: b, z: z1 }, { x: x1, y: b, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }] },
    { normal: { x: -1, y: 0, z: 0 }, points: [{ x: x0, y: b, z: z0 }, { x: x0, y: b, z: z1 }, { x: x0, y, z: z1 }, { x: x0, y, z: z0 }] },
    { normal: { x: 0, y: 1, z: 0 }, points: [{ x: x0, y, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }] },
  ];
}

interface MatteFace { readonly normal: Vec3; readonly points: readonly Vec3[] }
function faceArea(face: MatteFace): number {
  const origin = face.points[0]!;
  let area = 0;
  for (let index = 1; index < face.points.length - 1; index++) {
    const a = face.points[index]!, b = face.points[index + 1]!;
    const ax = a.x - origin.x, ay = a.y - origin.y, az = a.z - origin.z;
    const bx = b.x - origin.x, by = b.y - origin.y, bz = b.z - origin.z;
    area += Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  return area;
}
/** Geometric vertical-facet area, independent of alpha and screenshot scale. */
export function atlasFacadeCoverage(available: readonly MatteFace[], painted: readonly MatteFace[]) {
  const visibleFacadeArea = available.filter(face => Math.abs(face.normal.y) < .000001).reduce((sum, face) => sum + faceArea(face), 0);
  const matteFacadeArea = painted.filter(face => Math.abs(face.normal.y) < .000001).reduce((sum, face) => sum + faceArea(face), 0);
  return { visibleFacadeArea, matteFacadeArea, facadeMatteCoverage: visibleFacadeArea > 0 ? matteFacadeArea / visibleFacadeArea : 0 };
}

/** CPU clipping and coarse occlusion precede stable depth/color batching. */
export function projectAtlas(snapshot: AtlasSnapshot, width: number, height: number): AtlasProjection {
  const eye = snapshot.camera.eye, target = snapshot.camera.target;
  const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z, length = Math.hypot(dx, dy, dz);
  const forward = { x: dx / length, y: dy / length, z: dz / length };
  const horizontal = Math.hypot(forward.x, forward.z);
  const right = horizontal > 0.000001 ? { x: -forward.z / horizontal, y: 0, z: forward.x / horizontal } : { x: 1, y: 0, z: 0 };
  const up = { x: right.y * forward.z - right.z * forward.y, y: right.z * forward.x - right.x * forward.z, z: right.x * forward.y - right.y * forward.x };
  const focal = width * (snapshot.camera.focalScale ?? 0.74), cx = width * 0.5, cy = height * 0.49, scale = Math.min(width / 1280, height / 720);
  const nearPlane = 8, farPlane = 2200;
  const view = (point: Vec3): Vec3 => {
    const x = point.x - eye.x, y = point.y - eye.y, z = point.z - eye.z;
    return { x: x * right.x + y * right.y + z * right.z, y: x * up.x + y * up.y + z * up.z, z: x * forward.x + y * forward.y + z * forward.z };
  };
  const project = (point: Vec3, allowOutside = false): AtlasProjectedPoint | null => {
    const p = view(point);
    if (p.z < nearPlane || p.z > farPlane) return null;
    const x = cx + p.x * focal / p.z, y = cy - p.y * focal / p.z;
    if (!allowOutside && (x < -12 * scale || x > width + 12 * scale || y < -12 * scale || y > height + 12 * scale)) return null;
    return { x, y, depth: p.z };
  };
  const projectPolygon = (points: readonly Vec3[]) => {
    const clipped = clipPlane(clipPlane(points.map(view), "z", nearPlane, true), "z", farPlane, false);
    let screen = clipped.map(point => ({ x: cx + point.x * focal / point.z, y: cy - point.y * focal / point.z, z: point.z }));
    screen = clipPlane(clipPlane(clipPlane(clipPlane(screen, "x", 0, true), "x", width, false), "y", 0, true), "y", height, false);
    return screen.map(point => ({ x: point.x, y: point.y, depth: point.z }));
  };
  const grainPaths = Array.from({ length: DEPTHS * TONES }, () => "");
  const mattePaths = Array.from({ length: DEPTHS * MATTE_TONES }, () => "");
  const observation = { projectedArchitecture: 0, projectedRoofs: 0, projectedRoute: 0, projectedLandmarks: 0, projectedBed: 0 };
  const matteOpacity = 0.22 * snapshot.pose.assembly * (1 - Math.min(1, snapshot.pose.unmake * 4));
  let matteFacadeArea = 0, visibleFacadeArea = 0;
  if (matteOpacity > 0.00001) for (const mass of snapshot.masses) {
    if (mass.mass.shape !== "box" || mass.presence < 0.98) continue;
    const surfaces = mass.mass.terrace ? [...atlasBoxFaces(mass, 1, 0, 0.58), ...atlasBoxFaces(mass, 0.72, 0.58, 1)] : atlasBoxFaces(mass);
    const available = surfaces.filter(face => {
      const n = face.normal, anchor = face.points[0]!;
      return n.x * (eye.x - anchor.x) + n.y * (eye.y - anchor.y) + n.z * (eye.z - anchor.z) > 0;
    });
    // Roof underpainting supports the silhouettes; walls remain only grains.
    const faces = available.filter(face => face.normal.y > 0);
    const coverage = atlasFacadeCoverage(available, faces);
    matteFacadeArea += coverage.matteFacadeArea; visibleFacadeArea += coverage.visibleFacadeArea;
    for (const face of faces) {
      const n = face.normal, anchor = face.points[0]!;
      if (n.x * (eye.x - anchor.x) + n.y * (eye.y - anchor.y) + n.z * (eye.z - anchor.z) <= 0) continue;
      const shade = Math.min(2, Math.floor(clamp(0.2 + Math.max(0, n.x * -0.52 + n.y * 0.8 + n.z * 0.34) * 0.8) * 3));
      const points = face.points.map(view);
      for (let slice = 0; slice < DEPTHS; slice++) {
        const near = nearPlane * (farPlane / nearPlane) ** (slice / DEPTHS), far = nearPlane * (farPlane / nearPlane) ** ((slice + 1) / DEPTHS);
        let polygon = clipPlane(clipPlane(points, "z", near, true), "z", far, false);
        polygon = polygon.map(point => ({ x: cx + point.x * focal / point.z, y: cy - point.y * focal / point.z, z: point.z }));
        polygon = clipPlane(clipPlane(clipPlane(clipPlane(polygon, "x", 0, true), "x", width, false), "y", 0, true), "y", height, false);
        if (polygon.length < 3) continue;
        mattePaths[(DEPTHS - 1 - slice) * 3 + shade] += `M${polygon.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("L")}Z`;
      }
    }
  }

  for (const particle of snapshot.drawnParticles) {
    const grain = particle.grain;
    if (grain.role === "route" && snapshot.pose.routeAlpha < 0.001) continue;
    if (grain.role === "architecture" && particle.structural > 0.98) {
      const n = particle.normal;
      if (n.x * (eye.x - particle.x) + n.y * (eye.y - particle.y) + n.z * (eye.z - particle.z) < 0) continue;
    }
    const p = project(particle);
    if (!p || (particle.structural > 0.96 || grain.role !== "architecture") && occluded(snapshot, particle)) continue;
    const slice = Math.min(DEPTHS - 1, Math.floor(clamp(Math.log(p.depth / nearPlane) / Math.log(farPlane / nearPlane)) * DEPTHS));
    const radius = Math.max(0.68 * scale, Math.min(5.5 * scale, grain.size * focal / p.depth));
    grainPaths[(DEPTHS - 1 - slice) * TONES + particle.tone] += facet(p.x, p.y, radius, grain.seed);
    if (grain.role === "architecture") {
      observation.projectedArchitecture++;
      if (particle.normal.y > 0 && particle.structural > 0.8) observation.projectedRoofs++;
      if (grain.protected) observation.projectedLandmarks++;
    } else if (grain.role === "route") observation.projectedRoute++;
    else observation.projectedBed++;
  }
  return {
    grainPaths, mattePaths, matteOpacity, facadeMatteCoverage: visibleFacadeArea > 0 ? matteFacadeArea / visibleFacadeArea : 0, matteFacadeArea, visibleFacadeArea,
    width, height, project, projectPolygon, observation,
    finite: [eye.x, eye.y, eye.z, target.x, target.y, target.z, length, focal, forward.x, forward.y, forward.z, right.x, right.z].every(Number.isFinite) && length > 0.000001 && focal > 0,
  };
}
