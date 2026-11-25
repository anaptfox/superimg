//! Full-page HTML shell utilities, including readiness and KaTeX styles.

import { buildHeadStyles, type CssConfig } from "./css.js";
import { katexStyle as _katexStyle } from "./katex-css.node.js";

export { buildCompositeHtml } from "./composite.js";

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

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${headStyles}${SUPERIMG_READY_SCRIPT}</head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
}
