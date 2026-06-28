//! Type-only probe for director, track, and stdlib on RenderContext.
//! Nothing here executes; `tsc --noEmit` should validate the public shape.

import type { RenderContext } from "./types.js";
import type { Stdlib } from "./stdlib.js";

declare const std: Stdlib;
declare const ctx: RenderContext;

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
const L = std.layers({ width: 1920, height: 1080 });
const _handoffHtml = L.handoff({
  shared: [L.bg("bg")],
  transition: std.reveal.split({ from: "a", to: "b", progress: 0.5 }),
});