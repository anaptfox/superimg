import { Frame, Fill, Text, Vector, vector, type MediaElement } from "@foxworth/superimg";
import { CLEFT_PATHS, CLEFT_GAP_PATH, CLEFT_CUT_EDGES, CLEFT_PALETTE, cleftGrainLight, type CleftSnapshot } from "./model";

export interface CleftView {
  width: number;
  height: number;
  draw: (path: string, progress: number) => { strokeDasharray: string; strokeDashoffset: string };
  /** Poster keeps its title; the loop stays purely material. */
  labels?: boolean;
}

const TONES = 32;
const DEPTHS = 4;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const MINERAL = Array.from({ length: TONES }, (_, index) => {
  const p = index / (TONES - 1);
  return `rgb(${Math.round(mix(33, 109, p))},${Math.round(mix(32, 107, p))},${Math.round(mix(36, 112, p))})`;
});

function facet(x: number, y: number, radius: number, seed: number, angle: number): string {
  const dx = radius * (0.8 + seed * 0.4), dy = radius * (0.65 + seed * 0.3);
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return [[-dx, 0], [0, -dy], [dx, 0], [0, dy]].map(([px, py], i) =>
    `${i ? "L" : "M"}${(x + px! * cs - py! * sn).toFixed(3)},${(y + px! * sn + py! * cs).toFixed(3)}`,
  ).join("") + "Z";
}

/** Stable bins cap the material at 128 facet paths, regardless of population. */
export function cleftFacetBatches(snapshot: CleftSnapshot): readonly string[] {
  const bins = Array.from({ length: TONES * DEPTHS }, () => "");
  for (const grain of snapshot.drawnGrains) {
    const tone = Math.min(TONES - 1, Math.floor(cleftGrainLight(grain, snapshot) * TONES));
    bins[grain.depth * TONES + tone] += facet(grain.x, grain.y, grain.radius, grain.seed, grain.facetAngle);
  }
  return bins;
}

function graphiteEtch(): string {
  let path = "";
  for (let y = -12; y < 132; y += 1.65) path += `M-8,${y.toFixed(2)}l116,19`;
  return path;
}
const ETCH = graphiteEtch();

export function renderCleft(snapshot: CleftSnapshot, view: CleftView): MediaElement {
  const { width, height } = view;
  const square = Math.abs(width / height - 1) < 0.02;
  const baseScale = (square ? height * 0.66 : height * 0.68) / 120;
  const scale = baseScale * snapshot.camera.scale;
  const cx = width * 0.5, cy = height * (square ? 0.465 : 0.46);
  const transform = {
    x: cx - snapshot.camera.focusX * scale,
    y: cy - snapshot.camera.focusY * scale,
    scale,
  };
  const materialOpacity = snapshot.weights.mineral;
  const graphiteOpacity = snapshot.weights.graphite;
  const grainOpacity = materialOpacity + graphiteOpacity * 0.17;
  const bins = cleftFacetBatches(snapshot);
  const fullPath = CLEFT_PATHS.join(" ");
  const labels = view.labels ?? snapshot.kind !== "loop";
  const textScale = Math.min(width / 1280, height / 720);
  const captionWidth = Math.min(width * .84, Math.max(240, snapshot.caption.length * 7.5 + 32) * textScale);
  const titleOpacity = snapshot.titleOpacity * (labels ? 1 : 0);
  const reliefOpacity = snapshot.kind === "icon" ? 0 : snapshot.reveal.fill * (materialOpacity + graphiteOpacity * .45);
  const allGrains = bins.map((d, index) => vector.path({
    id: `cleft-grains-${index}`,
    d: d || "M0,0h1v1h-1Z",
    fill: MINERAL[index % TONES],
    opacity: d ? grainOpacity : 0,
  }));

  return Frame(
    { id: "cleft-stage", width, height },
    Fill({ id: "cleft-mist", color: CLEFT_PALETTE.mist }),
    Fill({ id: "cleft-raking-light", gradient: { kind: "linear", angle: "125deg", stops: ["#F3F4ED 0%", "#E7E9E4 44%", "#D2D8D1 100%"] } }),
    Vector(
      { id: "cleft-vector", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.defs(
        vector.clip({ id: "cleft-fixed-contour" }, vector.path({ id: "cleft-contour-geometry", d: fullPath, fill: "white" })),
        vector.clip({ id: "cleft-negative-cut" }, vector.path({ id: "cleft-gap-geometry", d: CLEFT_GAP_PATH, fill: "white" })),
      ),
      vector.group(
        { id: "cleft-geometry", transform },
        // Quiet embossed construction lines establish the stage before draw-on.
        vector.path({ id: "cleft-construction", d: fullPath, fill: "none", stroke: CLEFT_PALETTE.cut, strokeWidth: 0.18, opacity: 0.11 * (1 - snapshot.reveal.fill) }),
        vector.group(
          { id: "cleft-filled-mark", clip: "cleft-fixed-contour", opacity: snapshot.reveal.fill },
          vector.path({ id: "cleft-solid-contours", d: fullPath, fill: CLEFT_PALETTE.hematite }),
          // A broad mineral undercoat stays restrained so the small facets read.
          vector.path({ id: "cleft-mineral-ground", d: fullPath, fill: "#6B696D", opacity: materialOpacity * 0.48 }),
          ...allGrains,
          vector.path({ id: "cleft-graphite-ground", d: fullPath, fill: "#414046", opacity: graphiteOpacity * 0.68 }),
          vector.path({ id: "cleft-graphite-etch", d: ETCH, stroke: CLEFT_PALETTE.edge, strokeWidth: 0.19, opacity: graphiteOpacity * 0.64, fill: "none" }),
          // Only the lower slab's upper/left cut edges face the key. These
          // strokes are clipped into the slab; no uniform sticker outline.
          vector.path({ id: "cleft-cut-highlight", d: CLEFT_CUT_EDGES.facingKey, fill: "none", stroke: CLEFT_PALETTE.edge, strokeWidth: 1, opacity: reliefOpacity * .56 }),
          vector.path({ id: "cleft-cut-dark-edge", d: CLEFT_CUT_EDGES.awayFromKey, fill: "none", stroke: "#152019", strokeWidth: .42, opacity: reliefOpacity * .72 }),
        ),
        vector.group({ id: "cleft-gap-relief", clip: "cleft-negative-cut", opacity: reliefOpacity },
          // Upper slab shadows fall down/right into the cut. The canonical
          // gap clips both bands; the 64px ink icon receives no relief paint.
          vector.path({ id: "cleft-gap-shadow", d: CLEFT_CUT_EDGES.awayFromKey, transform: { x: .65, y: .65 }, fill: "none", stroke: "#26392F", strokeWidth: 2.1, strokeLinejoin: "miter", opacity: .11 }),
          vector.path({ id: "cleft-gap-occlusion", d: CLEFT_CUT_EDGES.awayFromKey, fill: "none", stroke: "#18271E", strokeWidth: .64, strokeLinejoin: "miter", opacity: .23 }),
        ),
        ...CLEFT_PATHS.map((d, i) => vector.path({
          id: `cleft-draw-${i}`, d, fill: "none", stroke: CLEFT_PALETTE.hematite,
          strokeWidth: 0.52,
          ...view.draw(d, i === 0 ? snapshot.reveal.upper : snapshot.reveal.lower),
          opacity: 1 - snapshot.reveal.fill,
        })),
      ),
    ),
    Frame(
      { id: "cleft-name-lockup", x: width * 0.1, y: height * 0.815, width: width * 0.8, height: height * 0.1, style: { opacity: titleOpacity } },
      Text({ id: "cleft-title", size: 28 * textScale, weight: 500, color: CLEFT_PALETTE.hematite, fontFamily: "Inter", letterSpacing: 7 * textScale, align: "center" }, "CLEFT"),
    ),
    Frame(
      { id: "cleft-caption-box", x: (width - captionWidth) / 2, y: height * 0.89, width: captionWidth, height: 34 * textScale, style: { opacity: snapshot.caption ? 1 : 0 } },
      Fill({ id: "cleft-caption-paper", color: CLEFT_PALETTE.mist, style: { opacity: .97 } }),
      Frame({ id: "cleft-caption-inset", x: 12 * textScale, y: 7 * textScale, width: captionWidth - 24 * textScale, height: 24 * textScale }, Text({ id: "cleft-caption", size: 13.5 * textScale, weight: 400, color: CLEFT_PALETTE.cut, fontFamily: "Inter", align: "center", letterSpacing: 0.15 * textScale }, snapshot.caption || " ")),
    ),
  );
}
