import * as THREE from "three";
import type { NativeSurfaceModule } from "@foxworth/superimg";

export interface GalaxyFrame { progress: number }

export default {
  create({ canvas, width, height, dpr }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const light = new THREE.PointLight(0x667eea, 1.8);
    light.position.set(2, 1, 3);
    scene.add(light);
    scene.fog = new THREE.Fog(0x020208, 18, 36);

    const count = 14000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const fract = (value: number) => value - Math.floor(value);
    for (let i = 0; i < count; i++) {
      const arm = i % 4, t = i / count;
      const theta = t * 7.5 + arm * (Math.PI * 2 / 4);
      const radius = 0.15 + Math.pow(t, 0.65) * 5.5;
      const jitter = (fract(Math.sin(i * 12.9898) * 43758.5453) - 0.5) * 0.38 * (1 - t * 0.5);
      positions[i * 3] = Math.cos(theta) * (radius + jitter);
      positions[i * 3 + 1] = (fract(Math.sin(i * 78.233) * 43758.5453) - 0.5) * 0.35 * (1 - t);
      positions[i * 3 + 2] = Math.sin(theta) * (radius + jitter);
      const color = new THREE.Color().setHSL((0.58 + t * 0.22 + arm * 0.04) % 1, 0.55 + t * 0.25, 0.45 + (1 - t) * 0.35);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.024, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
    const galaxy = new THREE.Points(geometry, material);
    scene.add(galaxy);
    const coreGeometry = new THREE.SphereGeometry(0.095, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5e6 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    return {
      sample({ data }) {
        const progress = data.progress;
        const orbit = progress * Math.PI * 2, cameraRadius = 10.5 - progress * 1.2;
        camera.position.set(Math.cos(orbit) * cameraRadius, 12 + Math.sin(progress * Math.PI * 2) * 0.6, Math.sin(orbit) * cameraRadius);
        camera.lookAt(0, 0, 0);
        galaxy.rotation.y = progress * Math.PI * 0.35;
        material.size = 0.024 + 0.004 * Math.sin(progress * Math.PI * 8);
        core.scale.setScalar(1 + 0.25 * Math.sin(progress * Math.PI * 4));
        renderer.render(scene, camera);
      },
      dispose() {
        geometry.dispose(); material.dispose(); coreGeometry.dispose(); coreMaterial.dispose();
        renderer.dispose(); renderer.forceContextLoss();
      },
    };
  },
} satisfies NativeSurfaceModule<GalaxyFrame>;
