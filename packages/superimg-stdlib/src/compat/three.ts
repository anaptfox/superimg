import { token as readyToken } from "../ready.js";
import { graphicsKey, retainedResourcesScript } from "../viz/retained.js";

/** Historical compatibility version; keep aligned with the installed preload. */
export const THREE_VERSION = "0.184.0";

/** Historical ESM URL recognized by the offline compatibility preload. */
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
   * Capture wait label (Playwright). Default: derived from size + scene source.
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
  return `three-${graphicsKey(`${opts.width}x${opts.height}:${opts.background ?? ""}:${opts.setup}:${opts.animate}`)}`;
}

/**
 * Emit a canvas + inline three.js scene for HTML-medium templates.
 * Playwright captures the rendered WebGL frame.
 *
 * - Single `renderer.render()` per frame (no RAF / setAnimationLoop).
 * - Setup/GPU resources are retained while the scene signature is unchanged.
 * - Canvas backing resolution follows the capture device pixel ratio.
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
  const signature = JSON.stringify([opts.width, opts.height, bg, opts.setup, opts.animate, opts.asyncSetup === true]);
  const create = `
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    const captureDpr = window.__SUPERIMG_CAPTURE_DPR__ || window.devicePixelRatio || 1;
    renderer.setPixelRatio(captureDpr);
    renderer.setSize(${opts.width}, ${opts.height}, false);
    canvas.style.width = "${opts.width}px";
    canvas.style.height = "${opts.height}px";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, ${opts.width}/${opts.height}, 0.1, 1000);
    camera.position.z = 4;
    let disposed = false;
    function dispose() {
      if (disposed) return;
      disposed = true;
      const released = new Set();
      function release(value) {
        if (!value || released.has(value)) return;
        released.add(value);
        if (typeof value.dispose === "function") value.dispose();
      }
      scene.traverse(function(object) {
        release(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          for (const value of Object.values(material)) if (value && value.isTexture) release(value);
          release(material);
        }
      });
      release(scene.background); release(scene.environment);
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }
    const state = { canvas, dispose, ready: null, draw: null };
    state.ready = (async function() {
      try {
        const progress = ${progress};
        ${opts.setup}
        state.draw = ${opts.asyncSetup ? "async " : ""}function(progress) {
          if (disposed) return;
          ${opts.animate}
          renderer.render(scene, camera);
        };
      } catch (error) { dispose(); throw error; }
    })();
    return state;
  `;
  const script = `(async function() {
    let state;
    try {
      const THREE = window.__SUPERIMG_THREE__;
      const host = document.currentScript.previousElementSibling;
      const canvas = host && host.querySelector("canvas");
      if (!THREE || !canvas) { ${failLine} return; }
      ${retainedResourcesScript}
      function create() { ${create} }
      state = resources.retain(${JSON.stringify(label || id)}, ${JSON.stringify(signature)} + ':' + (window.__SUPERIMG_CAPTURE_DPR__ || window.devicePixelRatio || 1), create);
      if (state.canvas !== canvas) canvas.replaceWith(state.canvas);
      await state.ready;
      await state.draw(${progress});
      ${doneLine}
    } catch (error) {
      if (state) state.dispose();
      ${failLine}
      throw error;
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
