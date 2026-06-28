export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectOpts {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CameraOpts {
  distance?: number;
  elevation?: number;
  azimuth?: number;
  fov?: number;
}

const DEG = Math.PI / 180;

function rotateY(p: Point3D, angle: number): Point3D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateX(p: Point3D, angle: number): Point3D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

export function isometric(p: Point3D, opts: ProjectOpts = {}): { x: number; y: number } {
  const s = opts.scale ?? 1;
  const ox = opts.offsetX ?? 0;
  const oy = opts.offsetY ?? 0;
  return {
    x: ox + (p.x - p.z) * 0.866 * s,
    y: oy + (p.x + p.z) * 0.5 * s - p.y * s,
  };
}

export function perspective(
  points: Point3D[],
  camera: CameraOpts = {},
  opts: ProjectOpts = {},
): Array<{ x: number; y: number; depth: number }> {
  const dist = camera.distance ?? 4;
  const elev = (camera.elevation ?? 25) * DEG;
  const azim = (camera.azimuth ?? 35) * DEG;
  const fov = (camera.fov ?? 45) * DEG;
  const s = opts.scale ?? 80;
  const ox = opts.offsetX ?? 0;
  const oy = opts.offsetY ?? 0;
  const focal = 1 / Math.tan(fov / 2);

  return points.map((p) => {
    let v = rotateY(p, azim);
    v = rotateX(v, elev);
    v = { x: v.x, y: v.y, z: v.z + dist };
    const depth = v.z;
    return {
      x: ox + (v.x * focal * s) / depth,
      y: oy + (-v.y * focal * s) / depth,
      depth,
    };
  });
}

export function path3d(
  points: Point3D[],
  mode: "isometric" | "perspective" = "isometric",
  opts: ProjectOpts & { camera?: CameraOpts } = {},
): string {
  if (points.length === 0) return "";
  const proj =
    mode === "isometric"
      ? points.map((p) => ({ ...isometric(p, opts), depth: p.z }))
      : perspective(points, opts.camera, opts);

  return proj
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

export function wireframe(
  edges: [Point3D, Point3D][],
  mode: "isometric" | "perspective" = "perspective",
  opts: ProjectOpts & { camera?: CameraOpts; color?: string; strokeWidth?: number } = {},
): string {
  const color = opts.color ?? "#5b8cff";
  const sw = opts.strokeWidth ?? 1.5;
  return edges
    .map(([a, b]) => {
      const pa = mode === "isometric" ? isometric(a, opts) : perspective([a], opts.camera, opts)[0]!;
      const pb = mode === "isometric" ? isometric(b, opts) : perspective([b], opts.camera, opts)[0]!;
      return `<line x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}" stroke="${color}" stroke-width="${sw}"/>`;
    })
    .join("\n");
}

export function cubeVertices(size = 1): Point3D[] {
  const h = size / 2;
  return [
    { x: -h, y: -h, z: -h },
    { x: h, y: -h, z: -h },
    { x: h, y: h, z: -h },
    { x: -h, y: h, z: -h },
    { x: -h, y: -h, z: h },
    { x: h, y: -h, z: h },
    { x: h, y: h, z: h },
    { x: -h, y: h, z: h },
  ];
}

export function cubeEdges(): [number, number][] {
  return [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
}