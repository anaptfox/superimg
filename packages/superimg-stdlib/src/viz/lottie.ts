import { token as readyToken } from "../ready.js";
import { graphicsKey, retainedResourcesScript } from "./retained.js";

/** Pin — light SVG build is default for SuperImg. */
export const LOTTIE_VERSION = "5.13.0";

export const LOTTIE_MODULE_LIGHT =
  `https://cdn.jsdelivr.net/npm/lottie-web@${LOTTIE_VERSION}/build/player/lottie_light.min.js`;
export const LOTTIE_MODULE_FULL =
  `https://cdn.jsdelivr.net/npm/lottie-web@${LOTTIE_VERSION}/build/player/lottie.min.js`;

export interface LottieOpts {
  /** Bodymovin JSON object (preferred over network path). */
  animationData: object;
  /** Scene-local progress 0–1. */
  progress: number;
  width: number;
  height: number;
  renderer?: "svg" | "canvas";
  /** light = no expressions (default); full = expressions. */
  player?: "light" | "full";
  assetsPath?: string;
  wait?: string | false;
  background?: string;
  preserveAspectRatio?: string;
}

/** Total frames from animation JSON (`op - ip`). */
export function durationFrames(animationData: { ip?: number; op?: number }): number {
  const ip = animationData.ip ?? 0;
  const op = animationData.op ?? 0;
  return Math.max(0, Math.floor(op - ip));
}

/** Duration in seconds from animation JSON. */
export function durationSeconds(animationData: { ip?: number; op?: number; fr?: number }): number {
  const fr = animationData.fr ?? 30;
  const frames = durationFrames(animationData);
  return frames / (fr || 30);
}


/**
 * Emit a Lottie player driven by SuperImg progress (no RAF).
 * Playwright preloads `window.lottie` when it sees this markup.
 *
 * Seek: `goToAndStop(progress * (totalFrames - 1), true)` only.
 * Reuses loaded animation state for unchanged data and destroys absent instances.
 */
export function lottie(opts: LottieOpts): string {
  if (!Number.isFinite(opts.progress)) {
    throw new Error("std.viz.lottie: progress must be a finite number 0–1");
  }
  if (!opts.animationData || typeof opts.animationData !== "object") {
    throw new Error("std.viz.lottie: animationData object is required");
  }

  const progress = Math.max(0, Math.min(1, opts.progress));
  const waitOff = opts.wait === false;
  const dataJson = JSON.stringify(opts.animationData);
  const signature = JSON.stringify([dataJson, opts.width, opts.height, opts.renderer, opts.player, opts.assetsPath, opts.preserveAspectRatio]);
  const label = typeof opts.wait === "string" && opts.wait.trim()
    ? opts.wait.trim() : `lottie-${graphicsKey(signature)}`;
  const w = waitOff ? null : readyToken(label);
  const id = label.replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const attr = w ? ` ${w.attr}` : "";
  const doneLine = w ? w.done : "";
  const failLine = w ? w.fail("lottie failed") : "";
  const bg = opts.background ?? "transparent";
  const renderer = opts.renderer ?? "svg";
  if (renderer === "canvas" && opts.player === "light") {
    throw new Error("std.viz.lottie: the light player supports SVG only; use player: 'full' for canvas");
  }
  // The literal is instantiated only when loading a new retained player.
  // Lottie can mutate it without touching authored sample data.
  // Omit the key entirely when unset. Emitting a literal `undefined` is
  // equivalent to bodymovin but trips the "undefined in output" check.
  const assetsPathJs =
    opts.assetsPath !== undefined
      ? `\n        assetsPath: ${JSON.stringify(opts.assetsPath)},`
      : "";
  const aspect = opts.preserveAspectRatio ?? "xMidYMid meet";
  const playerUrl =
    opts.player === "full" || renderer === "canvas" ? LOTTIE_MODULE_FULL : LOTTIE_MODULE_LIGHT;

  return `
<div id="${id}-wrap" style="width:${opts.width}px;height:${opts.height}px;background:${bg};overflow:hidden;position:relative;flex-shrink:0">
  <div id="${id}"${attr} style="width:100%;height:100%"></div>
</div>
<script data-superimg-lottie>
(async function() {
  let state;
  const host = document.currentScript.previousElementSibling;
  const el = host && host.firstElementChild;
  function fail() { ${failLine} }
  try {
    let lib = window.lottie || window.bodymovin;
    if (!lib) {
      await new Promise(function(resolve, reject) {
        const script = document.createElement("script");
        script.src = ${JSON.stringify(playerUrl)};
        script.onload = resolve;
        script.onerror = function() { reject(new Error("Lottie script load failed")); };
        document.head.appendChild(script);
      });
      lib = window.lottie || window.bodymovin;
    }
    if (!el || !lib || typeof lib.loadAnimation !== "function") throw new Error("Lottie player missing");
    ${retainedResourcesScript}
    const captureDpr = window.__SUPERIMG_CAPTURE_DPR__ || window.devicePixelRatio || 1;
    state = resources.retain(${JSON.stringify(label)}, ${JSON.stringify(signature)} + ':' + captureDpr, function() {
      let resolveReady, rejectReady;
      const ready = new Promise(function(resolve, reject) { resolveReady = resolve; rejectReady = reject; });
      // A disposed or failed instance can be removed before a caller awaits it.
      ready.catch(function() {});
      let disposed = false;
      const anim = lib.loadAnimation({
        container: el,
        renderer: ${JSON.stringify(renderer)},
        loop: false,
        autoplay: false,
        animationData: ${dataJson},${assetsPathJs}
        rendererSettings: {
          preserveAspectRatio: ${JSON.stringify(aspect)},
          progressiveLoad: false,
          hideOnTransparent: true,
          viewBoxOnly: true,
          dpr: captureDpr
        }
      });
      const loaded = function() { if (!disposed) resolveReady(); };
      const failed = function() { rejectReady(new Error("Lottie data failed")); };
      anim.addEventListener("DOMLoaded", loaded);
      anim.addEventListener("data_failed", failed);
      if (anim.isLoaded) loaded();
      if (anim.setSubframe) anim.setSubframe(true);
      return {
        el, anim, ready,
        dispose() {
          if (disposed) return;
          disposed = true;
          anim.removeEventListener("DOMLoaded", loaded);
          anim.removeEventListener("data_failed", failed);
          anim.destroy();
          rejectReady(new Error("Lottie instance disposed"));
        }
      };
    });
    if (state.el !== el) el.replaceWith(state.el);
    await state.ready;
    const total = Math.max(0, (state.anim.totalFrames || 1) - 1);
    state.anim.goToAndStop(${progress} * total, true);
    ${doneLine}
  } catch (error) {
    if (state) state.dispose();
    fail();
    throw error;
  }
})();
</script>`;
}
