//! Type-only probe for the cue namespace on ctx.std.
//! Nothing here executes; `tsc --noEmit` should validate the public shape.

import type { RenderContext } from "./types.js";
import type { Stdlib } from "./stdlib.js";

declare const std: Stdlib;
declare const ctx: RenderContext;

const transcriptSync = std.cue.transcript(
  [{ text: "hello", start: 0, end: 1 }],
  0.5,
);
const _currentWord = transcriptSync.current();
const _charProgress: number = transcriptSync.charProgress();

const markerSync = std.cue.markers(
  { intro: 0, outro: 1 },
  0.5,
);
const _markerProgress: number = markerSync.progress("intro", "outro");

const scriptSync = std.cue.script(
  [{ id: "hero", time: 0 }],
  0.1,
);
const _scriptEvent = scriptSync.get("hero");

const _ctxCue = ctx.std.cue.transcript(
  [{ text: "cue", start: 0, end: 1 }],
  ctx.sceneTimeSeconds,
);

const _ctxScore = ctx.std.score;

const t = std.score({ hook: "3.5s", features: "7s", cta: "5.5s" });
const _handoffP = t.transition("3s", "4s", "easeInOutCubic");
const _inHandoff: boolean = t.inSpan("3s", "4s");
const _handoffLocal = std.reveal.handoffLocal(_handoffP);
const _lead = std.stagger.lead(["a", "b"], t.within("features"), { duration: 0.5 });
const L = std.layers({ width: 1920, height: 1080 });
const _handoffHtml = L.handoff({
  shared: [L.bg("bg")],
  transition: std.reveal.split({ from: "a", to: "b", progress: 0.5 }),
});
