import { together } from "@foxworth/superimg";
import alternative from "./parts/alternative.media.js";
import baseline from "./parts/left.media.js";
import detail from "./parts/detail.media.js";

export const comparisonSize = { width: 1280, height: 720 } as const;
export const comparisonFps = 25;

// The first two children form a split screen. The third overlays them as PiP.
// All share one clock. The shorter children hold their final images until the
// baseline ends at frame 100.
export const comparison = together([
  {
    id: "baseline",
    content: baseline,
    rect: { x: 0, y: 0, width: 640, height: 720 },
    fit: "contain",
  },
  {
    id: "alternative",
    content: alternative,
    rect: { x: 640, y: 0, width: 640, height: 720 },
    fit: "contain",
  },
  {
    id: "detail",
    content: detail,
    rect: { x: 852, y: 430, width: 376, height: 212 },
    fit: "cover",
  },
], { end: "hold" });
