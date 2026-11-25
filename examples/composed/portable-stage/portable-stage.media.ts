import { rebaseCompositionSources, time, together } from "@foxworth/superimg";
import panel from "./parts/panel.media.js";
import badge from "./parts/badge.media.js";

const inner = together([
  { id: "panel", content: panel, variant: "cool", edition: "square", rect: { x: 0, y: 0, width: 960, height: 540 }, fit: "reflow" },
], { end: "hide" });

const program = together([
  { id: "stage", content: inner, rect: { x: 50, y: 70, width: 1100, height: 620 }, fit: "contain" },
  { id: "badge", content: badge, hold: "50f", rect: { x: 790, y: 25, width: 440, height: 190 }, fit: "contain" },
], { end: "hold" });

// Imported children retain their own relative resource paths. The named leaf
// receives an explicit source base before this normal synchronous projection.
const portable = rebaseCompositionSources(program, {
  "stage/panel": new URL("./parts/", import.meta.url),
});

export default time(portable, { size: { width: 1280, height: 720 }, fps: 25 });
