//! HTML utilities - build composite HTML from template output and background

import type { BackgroundValue } from "@superimg/types";
import { resolveBackground } from "../shared/assets.js";
import { escapeHtmlAttr, escapeCssUrl } from "./sanitize.js";
import { buildHeadStyles, type CssConfig } from "./css.js";
import { katexStyle as _katexStyle } from "./katex-css.node.js";

/**
 * Build composite HTML from template output and background
 */
/** Default background when none specified - industry standard black */
const DEFAULT_BACKGROUND = "#000000";

export function buildCompositeHtml(
  templateHtml: string,
  background: BackgroundValue | undefined,
  watermark: import("@superimg/types").WatermarkValue | undefined,
  width: number,
  height: number
): string {
  const layers: string[] = [];

  // Background layer - always render (default to black if not specified)
  const resolved = resolveBackground(background ?? DEFAULT_BACKGROUND);
  if (resolved.type === "solid") {
    const safeSrc = escapeHtmlAttr(resolved.src);
    layers.push(
      `<div style="position:absolute;inset:0;background:${safeSrc};opacity:${resolved.opacity}"></div>`
    );
  } else if (resolved.type === "image") {
    const fit = resolved.fit === "cover" ? "cover" : resolved.fit === "contain" ? "contain" : "cover";
    const safeSrc = escapeCssUrl(resolved.src);
    layers.push(
      `<div style="position:absolute;inset:0;background:url('${safeSrc}') center/${fit} no-repeat;opacity:${resolved.opacity}"></div>`
    );
  }

  // Template layer
  layers.push(
    `<div style="position:absolute;inset:0;overflow:hidden">${templateHtml}</div>`
  );

  // Watermark layer
  if (watermark) {
    layers.push(buildWatermarkHtml(watermark));
  }

  return layers.join("\n");
}

function buildWatermarkHtml(watermark: import("@superimg/types").WatermarkValue): string {
  const options = typeof watermark === "string" 
    ? { content: watermark, type: "image", position: "bottom-right", opacity: 0.8, width: undefined, height: undefined, style: undefined, className: undefined, href: undefined } 
    : { ...watermark, opacity: watermark.opacity ?? 0.8, position: watermark.position ?? "bottom-right" };

  let contentHtml = "";

  // Infer type if not provided
  let type = options.type;
  if (!type) {
    if (options.content.startsWith("<")) {
      type = "html";
    } else if (options.content.match(/\.(png|jpe?g|gif|webp|svg)$/i) || options.content.startsWith("data:image")) {
      type = "image";
    } else {
      type = "text";
    }
  }

  const safeContent = type === "html" ? options.content : escapeHtmlAttr(options.content);

  if (type === "image") {
    const widthStyle = options.width ? `width:${options.width}${typeof options.width === "number" ? "px" : ""};` : "";
    const heightStyle = options.height ? `height:${options.height}${typeof options.height === "number" ? "px" : ""};` : "";
    contentHtml = `<img src="${safeContent}" style="${widthStyle}${heightStyle}" alt="Watermark" />`;
  } else if (type === "text") {
    contentHtml = `<span>${options.content}</span>`; // Not escaped so HTML entities work, but user must be careful. For safety: escapeHtmlAttr
  } else {
    contentHtml = options.content;
  }

  // Handle position
  const positions: Record<string, string> = {
    "bottom-right": "bottom: 20px; right: 20px;",
    "bottom-left": "bottom: 20px; left: 20px;",
    "top-right": "top: 20px; right: 20px;",
    "top-left": "top: 20px; left: 20px;",
    "center": "top: 50%; left: 50%; transform: translate(-50%, -50%);",
  };
  
  const positionStyle = positions[options.position as string] || positions["bottom-right"];
  
  // Custom styles
  let customStyle = "";
  if (options.style) {
    customStyle = Object.entries(options.style)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }

  const containerStyle = `position: absolute; z-index: 9999; opacity: ${options.opacity}; ${positionStyle} ${customStyle}`;
  const containerClass = options.className ? ` class="${escapeHtmlAttr(options.className)}"` : "";

  let html = `<div style="${containerStyle}"${containerClass}>${contentHtml}</div>`;

  if (options.href) {
    const safeHref = escapeHtmlAttr(options.href);
    html = `<a href="${safeHref}" target="_blank" style="all: unset; cursor: pointer;">${html}</a>`;
  }

  return html;
}

/**
 * Inline registry for labeled frame readiness.
 * Templates call window.__superimgReady.done(label) / .fail(label, err).
 *
 * Capture protocol (per frame):
 * 1. __reset() — clear previous frame's signals
 * 2. Inject frame HTML and run inline scripts (may call done/fail synchronously)
 * 3. __wait(labels) — already-settled labels resolve immediately (see done-before-wait)
 *
 * Do NOT reset after scripts run — that erases canvas/WebGL/three.scene signals.
 */
export const SUPERIMG_READY_SCRIPT = `<script>
window.__superimgReady=(function(){
  var settled=Object.create(null);
  var waiters=Object.create(null);
  function ensure(label){
    if(!waiters[label]) waiters[label]=[];
    return waiters[label];
  }
  function done(label){
    if(label==null||label==="") return;
    settled[label]={ok:true};
    var q=waiters[label];
    if(q){ for(var i=0;i<q.length;i++) q[i].resolve(); waiters[label]=[]; }
  }
  function fail(label, err){
    if(label==null||label==="") return;
    var msg=err==null?("readiness failed: "+label):String(err);
    settled[label]={ok:false,error:msg};
    var q=waiters[label];
    if(q){ for(var i=0;i<q.length;i++) q[i].reject(new Error(msg)); waiters[label]=[]; }
  }
  function __reset(){ settled=Object.create(null); waiters=Object.create(null); }
  function __wait(labels, timeoutMs){
    labels=labels||[];
    timeoutMs=timeoutMs==null?8000:timeoutMs;
    if(!labels.length) return Promise.resolve({ok:true,open:[]});
    var open=labels.slice();
    return new Promise(function(resolve){
      var remaining=open.length;
      var finished=false;
      var timer=setTimeout(function(){
        if(finished) return;
        finished=true;
        var still=[];
        for(var i=0;i<open.length;i++){
          var s=settled[open[i]];
          if(!s||!s.ok) still.push(open[i]);
        }
        resolve({ok:false,open:still,error:"timeout"});
      }, timeoutMs);
      function oneDone(){
        remaining--;
        if(remaining<=0 && !finished){
          finished=true;
          clearTimeout(timer);
          resolve({ok:true,open:[]});
        }
      }
      for(var j=0;j<open.length;j++){
        (function(label){
          var s=settled[label];
          if(s){
            if(s.ok) oneDone();
            else {
              if(!finished){
                finished=true;
                clearTimeout(timer);
                resolve({ok:false,open:[label],error:s.error||"failed"});
              }
            }
            return;
          }
          ensure(label).push({
            resolve:function(){ oneDone(); },
            reject:function(e){
              if(finished) return;
              finished=true;
              clearTimeout(timer);
              resolve({ok:false,open:[label],error:e&&e.message?e.message:String(e)});
            }
          });
        })(open[j]);
      }
    });
  }
  return { done:done, fail:fail, __reset:__reset, __wait:__wait };
})();
</script>`;

export type SuperimgReadyRegistry = {
  done: (label: string) => void;
  fail: (label: string, err?: string) => void;
  __reset: () => void;
  __wait: (
    labels: string[],
    timeoutMs?: number,
  ) => Promise<{ ok: boolean; open: string[]; error?: string }>;
};

/**
 * Install the same readiness registry as SUPERIMG_READY_SCRIPT onto a window-like
 * object (for unit tests). Returns the registry.
 */
export function installSuperimgReady(
  target: { __superimgReady?: SuperimgReadyRegistry } = {},
): SuperimgReadyRegistry {
  const body = SUPERIMG_READY_SCRIPT.replace(/^<script>/, "").replace(/<\/script>$/, "");
  // eslint-disable-next-line no-new-func -- evaluate production shell script for tests
  const install = new Function(
    "window",
    `${body}\nreturn window.__superimgReady;`,
  ) as (w: { __superimgReady?: SuperimgReadyRegistry }) => SuperimgReadyRegistry;
  return install(target);
}

/**
 * Build page shell HTML with font links, stylesheets, and inline CSS.
 * Injected once per render session, not per frame.
 */
export function buildPageShell(config: CssConfig): string {
  const headStyles = buildHeadStyles(config, _katexStyle);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${headStyles}${SUPERIMG_READY_SCRIPT}</head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
}
