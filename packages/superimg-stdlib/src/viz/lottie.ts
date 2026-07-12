import { token as readyToken } from "../ready.js";

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

function labelFor(opts: LottieOpts, wait: string | false | undefined): string {
  if (typeof wait === "string" && wait.trim()) return wait.trim();
  // Include progress so each frame has a distinct wait id / readiness cycle
  const key = `${opts.width}x${opts.height}:${opts.progress.toFixed(4)}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `lottie-${(h >>> 0).toString(36)}`;
}

/**
 * Emit a Lottie player driven by SuperImg progress (no RAF).
 * Playwright preloads `window.lottie` when it sees this markup.
 *
 * Seek: `goToAndStop(progress * (totalFrames - 1), true)` only.
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
  const label = waitOff ? "" : labelFor(opts, opts.wait);
  const w = waitOff ? null : readyToken(label);
  const id = (waitOff ? `lottie-${opts.width}x${opts.height}` : label).replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const attr = w ? ` ${w.attr}` : "";
  const doneLine = w ? w.done : "";
  const failLine = w ? w.fail("lottie failed") : "";
  const bg = opts.background ?? "transparent";
  const renderer = opts.renderer ?? "svg";
  // Deep clone via JSON so lottie never mutates shared sample data
  const dataJson = JSON.stringify(opts.animationData);
  const assetsPathJs =
    opts.assetsPath !== undefined ? JSON.stringify(opts.assetsPath) : "undefined";
  const aspect = opts.preserveAspectRatio ?? "xMidYMid meet";
  const playerUrl =
    opts.player === "full" ? LOTTIE_MODULE_FULL : LOTTIE_MODULE_LIGHT;

  return `
<div id="${id}-wrap" style="width:${opts.width}px;height:${opts.height}px;background:${bg};overflow:hidden;position:relative;flex-shrink:0">
  <div id="${id}"${attr} style="width:100%;height:100%"></div>
</div>
<script data-superimg-lottie>
(function(){
  var progress = ${progress};
  function fail(msg) { ${failLine} }
  function done() { ${doneLine} }
  function run(lottieLib) {
    try {
      var el = document.getElementById(${JSON.stringify(id)});
      var lib = lottieLib || window.lottie || window.bodymovin;
      if (!el || !lib || typeof lib.loadAnimation !== "function") {
        fail("lottie player missing");
        return;
      }
      el.innerHTML = "";
      var data = ${dataJson};
      var anim = lib.loadAnimation({
        container: el,
        renderer: ${JSON.stringify(renderer)},
        loop: false,
        autoplay: false,
        animationData: data,
        assetsPath: ${assetsPathJs},
        rendererSettings: {
          preserveAspectRatio: ${JSON.stringify(aspect)},
          progressiveLoad: false,
          hideOnTransparent: true,
          viewBoxOnly: true
        }
      });
      function seekAndDone() {
        try {
          var total = Math.max(0, (anim.totalFrames || 1) - 1);
          var frame = progress * total;
          anim.goToAndStop(frame, true);
        } catch (err) {
          fail(String(err && err.message ? err.message : err));
          return;
        }
        done();
      }
      // animationData usually loads sync; still listen for DOMLoaded
      if (anim.isLoaded || anim.renderer) {
        // next microtask so SVG DOM is attached
        setTimeout(seekAndDone, 0);
      } else {
        anim.addEventListener("DOMLoaded", seekAndDone);
        anim.addEventListener("data_failed", function() { fail("lottie data_failed"); });
        // safety: if neither event fires
        setTimeout(function() {
          if (anim.isLoaded || anim.totalFrames > 0) seekAndDone();
        }, 50);
      }
    } catch (e) {
      fail(String(e && e.message ? e.message : e));
    }
  }
  if (window.lottie || window.bodymovin) run(window.lottie || window.bodymovin);
  else {
    var s = document.createElement("script");
    s.src = ${JSON.stringify(playerUrl)};
    s.onload = function() { run(window.lottie || window.bodymovin); };
    s.onerror = function() { fail("lottie script load failed"); };
    document.head.appendChild(s);
  }
})();
</script>`;
}
