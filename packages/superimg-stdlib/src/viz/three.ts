let uid = 0;

/** Pin to npm latest — see `npm view three version`. */
export const THREE_VERSION = "0.184.0";

/** Official ESM entry from npm — `npm view three` → 0.184.0, no UMD `three.min.js`. */
export const THREE_MODULE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;

export interface ThreeSceneOpts {
  width: number;
  height: number;
  /** Scene-local progress 0–1, inlined per frame. */
  progress: number;
  /** JS body executed inside the scene setup (`THREE`, `scene`, `camera`, `renderer` in scope). */
  setup: string;
  /** JS body executed each frame (`progress`, `THREE`, `scene`, `camera`, `renderer` in scope). */
  animate: string;
  background?: string;
}

/**
 * Emit a canvas + inline three.js scene for HTML-medium templates.
 * Playwright captures the rendered WebGL frame.
 *
 * Uses the official ESM build from npm (r150+ dropped UMD `three.min.js`).
 */
export function scene(opts: ThreeSceneOpts): string {
  const id = `three-${uid++}`;
  const bg = opts.background ?? "#0a0a0f";
  const progress = Number.isFinite(opts.progress) ? opts.progress : 0;

  return `
<div style="width:${opts.width}px;height:${opts.height}px;background:${bg};overflow:hidden;position:relative">
  <canvas id="${id}" width="${opts.width}" height="${opts.height}" style="display:block"></canvas>
</div>
<script data-superimg-scene>
(function(){
  const THREE = window.__SUPERIMG_THREE__;
  const canvas = document.getElementById("${id}");
  if (!THREE || !canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(${opts.width}, ${opts.height});
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, ${opts.width}/${opts.height}, 0.1, 1000);
  camera.position.z = 4;
  const progress = ${progress};
  ${opts.setup}
  ${opts.animate}
  renderer.render(scene, camera);
})();
</script>`;
}

export const helpers = {
  grid: () => `scene.add(new THREE.GridHelper(6, 12, 0x334155, 0x1e293b));`,
  axes: () => `scene.add(new THREE.AxesHelper(2));`,
  ambient: (intensity = 0.6) => `scene.add(new THREE.AmbientLight(0xffffff, ${intensity}));`,
  directional: (x = 2, y = 3, z = 4) => {
    return `const dl = new THREE.DirectionalLight(0xffffff, 1); dl.position.set(${x},${y},${z}); scene.add(dl);`;
  },
  point: (color = 0x5b8cff, intensity = 1.2, x = 0, y = 2, z = 3) =>
    `const pl = new THREE.PointLight(${color}, ${intensity}); pl.position.set(${x},${y},${z}); scene.add(pl);`,
  fog: (color = 0x0a0a0f, near = 3, far = 14) =>
    `scene.fog = new THREE.Fog(${color}, ${near}, ${far});`,
};