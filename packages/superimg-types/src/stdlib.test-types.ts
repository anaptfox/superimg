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

// @ts-expect-error — removed in the hard rename to cue
ctx.std["timeline"];
