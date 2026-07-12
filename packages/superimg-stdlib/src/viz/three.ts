import { token as readyToken } from "../ready.js";

/** Pin to npm latest — see `npm view three version`. */
export const THREE_VERSION = "0.184.0";

/** Official ESM entry from npm — `npm view three` → 0.184.0, no UMD `three.min.js`. */
export const THREE_MODULE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;

export interface ThreeSceneOpts {
  width: number;
  height: number;
  /**
   * Scene-local progress 0–1 (use `timeline.progress` or `d.in("phase")`).
   * Must be a finite number — never pass the timeline object.
   */
  progress: number;
  /** JS body executed inside the scene setup (`THREE`, `scene`, `camera`, `renderer` in scope). */
  setup: string;
  /** JS body executed each frame (`progress`, `THREE`, `scene`, `camera`, `renderer` in scope). */
  animate: string;
  background?: string;
  /**
   * Capture wait label (Playwright). Default: derived from size + progress hash.
   * Set `wait: false` to disable readiness gating for this scene.
   */
  wait?: string | false;
  /**
   * When true, wrap setup/animate in async IIFE so setup may `await` loaders.
   * Call readiness only after load + render. Default false (sync).
   */
  asyncSetup?: boolean;
}

/** Stable, pure-ish id from opts (avoids module uid++ for wait labels). */
function sceneLabel(opts: ThreeSceneOpts, wait: string | false | undefined): string {
  if (typeof wait === "string" && wait.trim()) return wait.trim();
  const key = `${opts.width}x${opts.height}:${opts.background ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `three-${(h >>> 0).toString(36)}`;
}

/**
 * Emit a canvas + inline three.js scene for HTML-medium templates.
 * Playwright captures the rendered WebGL frame.
 *
 * - Single `renderer.render()` per frame (no RAF / setAnimationLoop).
 * - Disposes GL context after paint to avoid context exhaustion on long clips.
 * - `preserveDrawingBuffer: true` for reliable screenshots.
 */
export function scene(opts: ThreeSceneOpts): string {
  const bg = opts.background ?? "#0a0a0f";
  if (!Number.isFinite(opts.progress)) {
    throw new Error(
      "std.viz.three.scene: progress must be a finite number (use timeline.progress or d.in(...), not the timeline object)",
    );
  }
  const progress = opts.progress;
  const waitOff = opts.wait === false;
  const label = waitOff ? "" : sceneLabel(opts, opts.wait);
  const w = waitOff ? null : readyToken(label);
  const id = waitOff
    ? `three-${sceneLabel(opts, undefined).replace(/^three-/, "")}`
    : label.replace(/[^a-zA-Z0-9_-]/g, "_");

  const attr = w ? ` ${w.attr}` : "";
  const doneLine = w ? w.done : "";
  const failLine = w ? w.fail("three.scene setup/render failed") : "";
  const asyncSetup = opts.asyncSetup === true;

  const body = `
    const THREE = window.__SUPERIMG_THREE__;
    const canvas = document.getElementById(${JSON.stringify(id)});
    if (!THREE || !canvas) { ${failLine} return; }
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(${opts.width}, ${opts.height}, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, ${opts.width}/${opts.height}, 0.1, 1000);
    camera.position.z = 4;
    const progress = ${progress};
    ${opts.setup}
    ${opts.animate}
    renderer.render(scene, camera);
    ${doneLine}
    try {
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    } catch (_) {}
  `;

  const script = asyncSetup
    ? `(async function(){
  try {
    ${body}
  } catch (e) {
    ${failLine}
    throw e;
  }
})();`
    : `(function(){
  try {
    ${body}
  } catch (e) {
    ${failLine}
    throw e;
  }
})();`;

  return `
<div style="width:${opts.width}px;height:${opts.height}px;background:${bg};overflow:hidden;position:relative">
  <canvas id="${id}"${attr} width="${opts.width}" height="${opts.height}" style="display:block"></canvas>
</div>
<script data-superimg-scene>
${script}
</script>`;
}

export const helpers = {
  /** Reseed THREE.MathUtils.seededRandom for deterministic noise. */
  seed: (n = 42) => `THREE.MathUtils.seededRandom(${Math.floor(n)});`,
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
