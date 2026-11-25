//! Type-only probe for director, track, and stdlib on RenderContext.
//! Nothing here executes; `tsc --noEmit` should validate the public shape.

import type { RenderContext } from "./types.js";
import type { Stdlib } from "./stdlib.js";

declare const std: Stdlib;
declare const ctx: RenderContext;

// Three worlds are authored as ordinary NativeSurface modules. The old
// string helper remains available for compatibility at runtime.
// @ts-expect-error legacy Three string helpers are not part of the public stdlib
std.viz.three;

const vo = ctx.track({
  words: [{ text: "hello", start: 0, end: 1 }],
});
const transcriptSync = vo.transcript();
const _currentWord = transcriptSync.current();
const _charProgress: number = transcriptSync.charProgress();

const markerSync = vo.markers();
const _markerProgress: number = markerSync.progress("intro", "outro");

const t = ctx.director({ hook: "3.5s", features: "7s", cta: "5.5s" });
const _handoffP = t.transition("3s", "4s", "easeInOutCubic");
const _inHandoff: boolean = t.inSpan("3s", "4s");
const _handoffLocal = std.reveal.handoffLocal(_handoffP);
const _lead = std.stagger.lead(["a", "b"], t.in("features"), { duration: 0.5 });
const car = std.carousel(["a", "b", "c"], { during: t.in("features") });
const _carouselState = car.state(0);
const stk = std.stack(["a", "b", "c"], { during: t.in("features") });
const _stackState = stk.state(0);
const _wipe = std.reveal.wipe({ progress: 0.5, direction: "diagonal", color: "#fff" });
const _beat = t.beats({ during: "features", of: ["a", "b"] as const, cross: "8%" });
