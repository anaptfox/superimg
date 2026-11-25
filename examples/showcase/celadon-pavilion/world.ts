//! "Pavilion" — an ordinary Three module. Setup builds the world once; sample()
//! is a pure function of absolute seconds (camera path, dust motes).

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { NativeSurfaceModule } from "@foxworth/superimg";

export interface PavilionData { duration: number }

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const C = {
  iron: 0x1f2925, brick: 0x9c5a3c, grass: 0x4a6a37, gravel: 0xb9a888, stone: 0xb7a58a,
  walnut: 0x5a3620, celadon: 0x8fb9a2, ivory: 0xe9e0c8, terracotta: 0xb8653b, tea: 0x8a4214,
  leaf: [0x3f6e3a, 0x4f7d3f, 0x2f5328, 0x5f8a45], hedge: [0x3d5e34, 0x4c6d3a, 0x2f4d2c, 0x5f7f45],
};

function bar(a: THREE.Vector3, b: THREE.Vector3, t: number, mat: THREE.Material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function lathe(points: [number, number][], mat: THREE.Material, segments = 48) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(0.09, 0.12, 0, 0.3); s.quadraticCurveTo(-0.09, 0.12, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  // Gentle fold along the midrib so leaves catch light on two planes.
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.6 - p.getY(i) * p.getY(i) * 0.4);
  g.computeVertexNormals();
  return g;
}

/** A potted plant: arching fronds of instanced leaves. */
function plant(rand: () => number, leaf: THREE.BufferGeometry, scale: number, fronds: number) {
  const group = new THREE.Group();
  const mats = C.leaf.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
  const per = 9;
  const meshes = mats.map((m) => new THREE.InstancedMesh(leaf, m, fronds * per));
  const counts = mats.map(() => 0);
  const o = new THREE.Object3D();
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + rand() * 0.5, pitch = 0.35 + rand() * 0.7, len = (0.5 + rand() * 0.5) * scale;
    for (let i = 0; i < per; i++) {
      const t = (i + 1) / per;
      const r = Math.sin(pitch) * len * t, y = Math.cos(pitch) * len * t - 0.55 * len * t * t;
      o.position.set(Math.cos(yaw) * r, y + 0.05, Math.sin(yaw) * r);
      o.rotation.set(-pitch - t * 1.1 + (rand() - 0.5) * 0.4, -yaw + Math.PI / 2, (rand() - 0.5) * 0.6, "YXZ");
      const s = scale * (1.1 - t * 0.55) * (0.8 + rand() * 0.4);
      o.scale.set(s, s, s); o.updateMatrix();
      const k = Math.floor(rand() * meshes.length);
      meshes[k]!.setMatrixAt(counts[k]!++, o.matrix);
    }
  }
  meshes.forEach((m, k) => { m.count = counts[k]!; m.castShadow = true; m.receiveShadow = true; group.add(m); });
  return group;
}

function teapot(celadon: THREE.Material) {
  const g = new THREE.Group();
  const body = lathe([[0, 0], [0.05, 0], [0.058, 0.006], [0.085, 0.03], [0.098, 0.06], [0.094, 0.09], [0.075, 0.115], [0.055, 0.125], [0, 0.125]], celadon);
  const lid = lathe([[0, 0.155], [0.012, 0.155], [0.014, 0.145], [0.03, 0.14], [0.052, 0.13], [0.058, 0.124], [0, 0.124]], celadon);
  const spoutCurve = new THREE.CatmullRomCurve3([v(0.08, 0.045, 0), v(0.125, 0.065, 0), v(0.15, 0.1, 0), v(0.162, 0.128, 0)]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 24, 0.014, 12), celadon);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 10, 32, Math.PI * 1.15), celadon);
  handle.position.set(-0.098, 0.065, 0); handle.rotation.z = Math.PI * 0.43;
  [spout, handle].forEach((m) => { m.castShadow = true; });
  g.add(body, lid, spout, handle);
  return g;
}

function cup(glaze: THREE.Material, teaMat: THREE.Material) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.026, 0], [0.028, 0.006], [0.044, 0.03], [0.052, 0.06], [0.049, 0.06], [0.041, 0.032], [0.024, 0.012], [0, 0.012]], glaze, 40));
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.046, 32), teaMat);
  tea.rotation.x = -Math.PI / 2; tea.position.y = 0.05; g.add(tea);
  return g;
}

interface World {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  path: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3; motes: THREE.Points; moteSeeds: Float32Array;
}

function createWorld({ canvas, width, height, dpr }: { canvas: HTMLCanvasElement; width: number; height: number; dpr: number }): World {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7d6a6);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture; scene.environmentIntensity = 0.35;
    pmrem.dispose();
    // Sky dome: warm horizon to pale zenith, glow toward the sun.
    const skyGeo = new THREE.SphereGeometry(60, 32, 16);
    const sunDir = new THREE.Vector3(9, 6.5, -7).normalize();
    const cols: number[] = []; const sp = skyGeo.attributes.position as THREE.BufferAttribute;
    const horizon = new THREE.Color(0xf2dca6), zenith = new THREE.Color(0xc7d3c0), glow = new THREE.Color(0xfff2d2), tmp = new THREE.Color();
    for (let i = 0; i < sp.count; i++) {
      const d = new THREE.Vector3(sp.getX(i), sp.getY(i), sp.getZ(i)).normalize();
      tmp.copy(horizon).lerp(zenith, Math.min(1, Math.max(0, d.y * 1.6)));
      tmp.lerp(glow, Math.pow(Math.max(0, d.dot(sunDir)), 6) * 0.9);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    scene.fog = new THREE.FogExp2(0xd8cf9f, 0.022);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 120);
    const rand = rng(1931);

    // Light: low warm sun behind-right, sky/ground fill, lamp.
    const sun = new THREE.DirectionalLight(0xffd29a, 3.2);
    sun.position.set(9, 6.5, -7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    scene.add(sun, sun.target, new THREE.HemisphereLight(0xf3dfb3, 0x3b4a2e, 0.75));

    const iron = new THREE.MeshStandardMaterial({ color: C.iron, metalness: 0.55, roughness: 0.42 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6dc, transparent: true, opacity: 0.2, roughness: 0.03, metalness: 0, clearcoat: 1, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
    const brick = new THREE.MeshStandardMaterial({ color: C.brick, roughness: 0.9 });
    const celadon = new THREE.MeshPhysicalMaterial({ color: C.celadon, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const ivory = new THREE.MeshPhysicalMaterial({ color: C.ivory, roughness: 0.25, clearcoat: 0.6 });
    const teaMat = new THREE.MeshStandardMaterial({ color: C.tea, roughness: 0.08, metalness: 0.1 });
    const walnut = new THREE.MeshStandardMaterial({ color: C.walnut, roughness: 0.55 });
    const terracotta = new THREE.MeshStandardMaterial({ color: C.terracotta, roughness: 0.85 });
    const leaf = leafGeometry();

    // Ground, path, interior stone floor.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: C.grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 14), new THREE.MeshStandardMaterial({ color: C.gravel, roughness: 1 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.005, 11); path.receiveShadow = true; scene.add(path);
    const tiles = document.createElement("canvas"); tiles.width = tiles.height = 512;
    const tc = tiles.getContext("2d")!;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const k = 150 + Math.floor(rand() * 30); tc.fillStyle = `rgb(${k + 40},${k + 22},${k})`; tc.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
    const tileTex = new THREE.CanvasTexture(tiles); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(3, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; floor.receiveShadow = true; scene.add(floor);

    // Pavilion: brick knee wall, iron frame, glass skin, gabled roof, open door.
    const P = new THREE.Group(); scene.add(P);
    const W = 3, D = 4, EAVE = 2.8, RIDGE = 4.0, KNEE = 0.5, DOOR = 0.62;
    const knee = (x0: number, z0: number, x1: number, z1: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.16, KNEE, Math.abs(z1 - z0) || 0.16), brick);
      m.position.set((x0 + x1) / 2, KNEE / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; P.add(m);
    };
    knee(-W, -D, W, -D); knee(-W, -D, -W, D); knee(W, -D, W, D); knee(-W, D, -DOOR, D); knee(DOOR, D, W, D);
    for (let x = -W; x <= W + 1e-6; x += 1) { P.add(bar(v(x, KNEE, -D), v(x, EAVE, -D), 0.06, iron)); if (Math.abs(x) > DOOR) P.add(bar(v(x, KNEE, D), v(x, EAVE, D), 0.06, iron)); }
    for (let z = -D; z <= D + 1e-6; z += 1) for (const x of [-W, W]) P.add(bar(v(x, KNEE, z), v(x, EAVE, z), 0.06, iron));
    for (const y of [1.6, EAVE]) {
      P.add(bar(v(-W, y, -D), v(W, y, -D), 0.05, iron)); P.add(bar(v(-W, y, -D), v(-W, y, D), 0.05, iron)); P.add(bar(v(W, y, -D), v(W, y, D), 0.05, iron));
      P.add(bar(v(-W, y, D), v(-DOOR, y, D), 0.05, iron)); P.add(bar(v(DOOR, y, D), v(W, y, D), 0.05, iron));
    }
    P.add(bar(v(-DOOR, 0, D), v(-DOOR, 2.3, D), 0.08, iron), bar(v(DOOR, 0, D), v(DOOR, 2.3, D), 0.08, iron), bar(v(-DOOR, 2.3, D), v(DOOR, 2.3, D), 0.08, iron));
    P.add(bar(v(-W, EAVE, D), v(W, EAVE, D), 0.06, iron));
    for (let z = -D; z <= D + 1e-6; z += 1) { P.add(bar(v(-W, EAVE, z), v(0, RIDGE, z), 0.05, iron)); P.add(bar(v(W, EAVE, z), v(0, RIDGE, z), 0.05, iron)); }
    P.add(bar(v(0, RIDGE, -D), v(0, RIDGE, D), 0.07, iron));
    for (const s of [-1, 1]) P.add(bar(v(s * W / 2, (EAVE + RIDGE) / 2, -D), v(s * W / 2, (EAVE + RIDGE) / 2, D), 0.04, iron));
    // Gable ends.
    for (const z of [-D, D]) { P.add(bar(v(-W, EAVE, z), v(0, RIDGE, z), 0.06, iron)); P.add(bar(v(W, EAVE, z), v(0, RIDGE, z), 0.06, iron)); P.add(bar(v(0, EAVE, z), v(0, RIDGE, z), 0.04, iron)); }
    const pane = (w: number, h: number, pos: THREE.Vector3, rotY = 0, rotX = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass); m.position.copy(pos); m.rotation.set(rotX, rotY, 0, "YXZ"); m.renderOrder = 2; P.add(m); };
    const hw = EAVE - KNEE;
    pane(2 * W, hw, v(0, KNEE + hw / 2, -D)); pane(2 * D, hw, v(-W, KNEE + hw / 2, 0), Math.PI / 2); pane(2 * D, hw, v(W, KNEE + hw / 2, 0), Math.PI / 2);
    pane(W - DOOR, hw, v(-(W + DOOR) / 2, KNEE + hw / 2, D)); pane(W - DOOR, hw, v((W + DOOR) / 2, KNEE + hw / 2, D)); pane(2 * DOOR, EAVE - 2.3, v(0, 2.3 + (EAVE - 2.3) / 2, D));
    const slope = Math.atan2(RIDGE - EAVE, W), sl = Math.hypot(W, RIDGE - EAVE);
    for (const s of [-1, 1]) pane(2 * D, sl, v(s * W / 2, (EAVE + RIDGE) / 2, 0), Math.PI / 2, s * (Math.PI / 2 - slope) * -1);
    // Open door leaf: hinged on the right jamb, swung outward.
    const door = new THREE.Group(); door.position.set(DOOR, 0, D); door.rotation.y = -1.95;
    door.add(bar(v(0, 0.02, 0), v(0, 2.28, 0), 0.05, iron), bar(v(-2 * DOOR, 0.02, 0), v(-2 * DOOR, 2.28, 0), 0.05, iron), bar(v(0, 2.28, 0), v(-2 * DOOR, 2.28, 0), 0.05, iron), bar(v(0, 0.02, 0), v(-2 * DOOR, 0.02, 0), 0.05, iron), bar(v(0, 1.1, 0), v(-2 * DOOR, 1.1, 0), 0.04, iron));
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR, 2.26), glass); dp.position.set(-DOOR, 1.15, 0); dp.renderOrder = 2; door.add(dp);
    P.add(door);

    // Interior: tea table, celadon set, plant benches, lamp.
    const table = new THREE.Group(); table.position.set(0, 0, -1.7); scene.add(table);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.9), walnut); top.position.y = 0.78; top.castShadow = top.receiveShadow = true; table.add(top);
    for (const [x, z] of [[-1, -0.38], [1, -0.38], [-1, 0.38], [1, 0.38]] as const) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), walnut); l.position.set(x, 0.375, z); l.castShadow = true; table.add(l); }
    const runner = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.004, 0.36), new THREE.MeshStandardMaterial({ color: 0xe6dbc0, roughness: 0.95 })); runner.position.y = 0.812; runner.receiveShadow = true; table.add(runner);
    const pot = teapot(celadon); pot.position.set(-0.12, 0.815, 0.02); pot.rotation.y = 0.5; pot.scale.setScalar(1.25); table.add(pot);
    const trivet = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 32), iron); trivet.rotation.x = Math.PI / 2; trivet.position.set(-0.12, 0.818, 0.02); table.add(trivet);
    const c1 = cup(celadon, teaMat); c1.position.set(0.28, 0.814, 0.12); table.add(c1);
    const c2 = cup(ivory, teaMat); c2.position.set(0.46, 0.814, -0.08); c2.scale.setScalar(0.92); table.add(c2);
    const tinMats = [0x8a4f33, 0x3f6b5c, 0x2d333b].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.35 }));
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a160, metalness: 0.8, roughness: 0.3 });
    tinMats.forEach((m, i) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14 - i * 0.015, 28), m); t.position.set(0.75 + i * 0.11, 0.81 + (0.14 - i * 0.015) / 2, -0.25); t.castShadow = true; table.add(t); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 28), brass); lid.position.set(t.position.x, 0.81 + 0.14 - i * 0.015, -0.25); table.add(lid); });
    for (const s of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 6.4), walnut); bench.position.set(s * 2.55, 0.68, -0.4); bench.castShadow = bench.receiveShadow = true; scene.add(bench);
      for (let i = 0; i < 6; i++) {
        const z = -3.4 + i * 1.15 + rand() * 0.2, size = 0.7 + rand() * 0.5;
        const pt = lathe([[0, 0], [0.09, 0], [0.12, 0.2], [0.13, 0.2], [0.13, 0.23], [0, 0.23]], terracotta, 24);
        pt.position.set(s * 2.55, 0.705, z); pt.scale.setScalar(size); scene.add(pt);
        const pl = plant(rand, leaf, 0.75 * size, 9 + Math.floor(rand() * 5)); pl.position.set(s * 2.55, 0.705 + 0.22 * size, z); scene.add(pl);
      }
    }
    const lamp = new THREE.Group(); lamp.position.set(0.1, 2.35, -1.7); scene.add(lamp);
    const shade = lathe([[0.02, 0.18], [0.04, 0.16], [0.16, 0.02], [0.17, 0], [0.165, 0], [0.035, 0.15], [0.015, 0.17]], brass, 32); shade.castShadow = false; lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1cf })); bulb.position.y = 0.03; lamp.add(bulb);
    lamp.add(bar(v(0, 0.18, 0), v(0, 1.6, 0), 0.01, iron));
    const lampLight = new THREE.PointLight(0xffc477, 3.5, 5, 2); lampLight.position.y = -0.02; lamp.add(lampLight);

    // Garden: hedges, trees, foreground plants for parallax near the camera start.
    const hedgeMats = C.hedge.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const blob = new THREE.IcosahedronGeometry(1, 3);
    const clump = (x: number, z: number, r: number, h: number, n: number) => { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(blob, hedgeMats[Math.floor(rand() * hedgeMats.length)]!); m.position.set(x + (rand() - 0.5) * r * 1.6, h * (0.4 + rand() * 0.6), z + (rand() - 0.5) * r * 1.2); m.scale.setScalar(r * (0.45 + rand() * 0.35)); m.castShadow = true; m.receiveShadow = true; scene.add(m); } };
    for (let x = -14; x <= 14; x += 2.2) { if (Math.abs(x) < 4.2) continue; clump(x, 6.5 + rand(), 1.1, 1.0, 3); }
    for (let i = 0; i < 9; i++) { const x = -12 + i * 3 + rand(), z = -9 - rand() * 5; const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 })); trunk.position.set(x, 1.5, z); trunk.castShadow = true; scene.add(trunk); clump(x, z, 2.2, 4.2, 5); }
    for (let i = 0; i < 34; i++) {
      const x = (rand() < 0.5 ? -1 : 1) * (1.3 + rand() * 9), z = 4.6 + rand() * 11;
      const pl = plant(rand, leaf, 0.5 + rand() * 0.6, 10); pl.position.set(x, 0, z); scene.add(pl);
    }
    for (const [x, z, s] of [[-2.4, 11.2, 1.5], [2.2, 10.0, 1.3], [-1.9, 7.6, 1.0], [1.8, 6.4, 0.9], [-3.6, 9.0, 1.6], [3.4, 12.0, 1.6]] as const) {
      const pl = plant(rand, leaf, s, 16); pl.position.set(x, 0, z); scene.add(pl);
    }

    // Dust motes in the interior light: positions are a function of (seed, seconds).
    const N = 260, moteSeeds = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) moteSeeds.set([rand() * 5 - 2.5, rand() * 2.2 + 0.4, rand() * 6 - 3.6, rand() * Math.PI * 2], i * 4);
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.018, transparent: true, opacity: 0.75, depthWrite: false }));
    scene.add(motes);

    const pathCurve = new THREE.CatmullRomCurve3([v(-2.0, 1.65, 14.5), v(-0.9, 1.52, 9.4), v(-0.05, 1.45, 5.4), v(0.05, 1.38, 3.0), v(0.45, 1.2, 0.4), v(0.62, 1.1, -0.82)], false, "centripetal");
    const lookCurve = new THREE.CatmullRomCurve3([v(0.2, 1.7, 0), v(0.1, 1.45, -1), v(0, 1.1, -1.75), v(-0.08, 0.9, -1.7)], false, "centripetal");
    return { renderer, scene, camera, path: pathCurve, look: lookCurve, motes, moteSeeds };
}

function sampleWorld(w: World, { seconds, data }: { seconds: number; data: PavilionData }) {
    const u = Math.min(1, Math.max(0, seconds / data.duration));
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    w.camera.position.copy(w.path.getPoint(e));
    w.camera.lookAt(w.look.getPoint(Math.min(1, e * 1.05)));
    w.camera.fov = 44 - 8 * e; w.camera.updateProjectionMatrix();
    const pos = w.motes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z, ph] = [w.moteSeeds[i * 4]!, w.moteSeeds[i * 4 + 1]!, w.moteSeeds[i * 4 + 2]!, w.moteSeeds[i * 4 + 3]!];
      pos.setXYZ(i, x + 0.12 * Math.sin(seconds * 0.35 + ph), y + 0.08 * Math.sin(seconds * 0.27 + ph * 1.7), z + 0.1 * Math.cos(seconds * 0.3 + ph));
    }
    pos.needsUpdate = true;
    w.renderer.render(w.scene, w.camera);
}

function disposeWorld(w: World) {
    const seen = new Set<unknown>();
    w.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      for (const r of [m.geometry, ...(Array.isArray(m.material) ? m.material : [m.material])]) {
        if (r && !seen.has(r)) { seen.add(r); for (const val of Object.values(r as object)) if ((val as THREE.Texture)?.isTexture) (val as THREE.Texture).dispose(); (r as { dispose?: () => void }).dispose?.(); }
      }
    });
    w.renderer.dispose(); w.renderer.forceContextLoss();
}

export default {
  create(host) {
    const world = createWorld(host);
    return { sample: (frame) => sampleWorld(world, frame), dispose: () => disposeWorld(world) };
  },
} satisfies NativeSurfaceModule<PavilionData>;
