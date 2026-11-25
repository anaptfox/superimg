//! "The Pour": one Scene, persistent instances, camera cuts. Artwork comes
//! from the shared editable SVG documents; this file only places and edits.

import { Instance, Scene, visual, svgPart, type SvgPaintEdit as SvgEdit } from "@foxworth/superimg";
import { cupDoc, envDoc, handDoc, potDoc, shadowDoc, streamDoc, teaEdits, trivetDoc } from "./art.ts";
import { CUP, CUP_SCALE, GRIP_ANCHOR, POT_SCALE, SPOUT_ANCHOR, TRIVET, type PourState } from "./action.ts";

// Paint bands: scene-wide layering, independent of instance order.
const B = { env: 0, shadow: 1, trivet: 2, handBack: 3, pot: 4, cupBack: 5, stream: 6, cupFront: 7, fingers: 8, steam: 9 } as const;

export const environment = visual<{ focus: number }>({
  id: "atelier.bench",
  render: ({ data }) => ({ parts: [svgPart("room", { document: envDoc, band: B.env,
    edits: {
      "far-blur-amount": { stdDeviation: data.focus },
      "garden-blur-amount": { stdDeviation: 3 + data.focus * 1.4 },
      "mid-blur-amount": { stdDeviation: Math.max(0.01, data.focus * 0.55) },
    } })] }),
});

export const pot = visual<{ settle: number }>({
  id: "celadon.pot",
  render: ({ data }) => ({
    parts: [svgPart("pot", { document: potDoc, band: B.pot,
      ...(data.settle ? { edits: { "pot-lid": { transform: { x: 0, y: Number((-data.settle * 3).toFixed(3)) } } } } : {}) })],
    anchors: { grip: GRIP_ANCHOR, spout: SPOUT_ANCHOR },
  }),
});

export const hand = visual<null>({
  id: "linen.hand",
  render: () => ({ parts: [
    svgPart("back", { document: handDoc, only: "hand-back", band: B.handBack }),
    svgPart("fingers", { document: handDoc, only: "hand-fingers", band: B.fingers }),
  ] }),
});

export const trivet = visual<null>({ id: "iron.trivet", render: () => ({ parts: [svgPart("iron", { document: trivetDoc, band: B.trivet })] }) });

export const contactShadow = visual<{ lift: number }>({
  id: "bench.shadow",
  render: ({ data }) => {
    const u = Math.min(1, data.lift / 120);
    return { parts: [svgPart("shade", { document: shadowDoc, band: B.shadow, edits: {
      contact: { opacity: 0.6 * (1 - u) ** 2, rx: 72 * (1 + u * 0.5) },
      penumbra: { opacity: 0.38 * (1 - u * 0.7), rx: 120 * (1 + u * 0.35), ry: 24 * (1 + u * 0.35) },
    } })] };
  },
});

export const cup = visual<{ edits: Record<string, SvgEdit> }>({
  id: "celadon.cup",
  render: ({ data }) => ({ parts: [
    svgPart("steam", { document: cupDoc, only: "steam", band: B.steam, edits: data.edits }),
    svgPart("back", { document: cupDoc, only: "bowl-back", band: B.cupBack, edits: data.edits }),
    svgPart("front", { document: cupDoc, only: "bowl-front", band: B.cupFront, edits: data.edits }),
  ] }),
});

/** Stream geometry in its own world-vertical frame: a falling parabola from the lip. */
function streamEdits(length: number, head: number, tail: number): Record<string, SvgEdit> {
  const y0 = length * tail, y1 = length * head;
  const xAt = (y: number) => 2.2 * Math.sqrt(Math.max(0, y));
  const wAt = (y: number) => 4.4 - 1.4 * Math.min(1, y / 60) + 0.6 * Math.min(1, y / length);
  const steps = 14, left: string[] = [], right: string[] = [], glint: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps, x = xAt(y), w = wAt(y);
    left.push(`${(x - w).toFixed(2)} ${y.toFixed(2)}`);
    right.unshift(`${(x + w).toFixed(2)} ${y.toFixed(2)}`);
    glint.push(`${(x + w * 0.35).toFixed(2)} ${y.toFixed(2)}`);
  }
  return {
    "stream-body": { d: `M${left.join("L")}L${right.join("L")}Z` },
    "stream-glint": { d: `M${glint.slice(1, -2).join("L")}` },
  };
}

export const stream = visual<{ length: number; head: number; tail: number }>({
  id: "tea.stream",
  render: ({ data }) => ({ parts: [svgPart("liquor", { document: streamDoc, band: B.stream, edits: streamEdits(data.length, data.head, data.tail) })] }),
});

function steamEdits(seconds: number): Record<string, SvgEdit> {
  const a = Math.sin(seconds * 1.7) * 4, b = Math.sin(seconds * 1.3 + 1.2) * 5;
  return {
    "steam-a": { transform: { x: Number(a.toFixed(2)), y: Number((-(seconds * 9) % 12).toFixed(2)) } },
    "steam-b": { transform: { x: Number(b.toFixed(2)), y: Number((-(seconds * 7 + 5) % 12).toFixed(2)) } },
  };
}

export function pourScene(state: PourState, width = 1280, height = 720) {
  const k = width / 1280;
  const cam = state.shot.camera;
  const focus = state.shot.id === "close" ? 5 : state.shot.id === "medium" ? 2.2 : 0.6;
  return Scene({ id: "pour", width, height, camera: { x: cam.x, y: cam.y, zoom: cam.zoom * k } },
    Instance({ id: "bench", entityId: "atelier-bench", of: environment, data: { focus }, at: { x: 0, y: 0 } }),
    Instance({ id: "trivet", entityId: "trivet-1", of: trivet, data: null, at: TRIVET }),
    Instance({ id: "pot-shadow", of: contactShadow, data: { lift: state.lift }, at: { x: state.pot.x + 6, y: TRIVET.y - 4 }, transform: { scale: POT_SCALE } }),
    Instance({ id: "cup-shadow", of: contactShadow, data: { lift: 0 }, at: { x: CUP.x + 4, y: CUP.y + 1 }, transform: { scaleX: CUP_SCALE * 0.62, scaleY: CUP_SCALE * 0.7 } }),
    Instance({ id: "pot", entityId: "teapot-1", of: pot, data: { settle: state.settle }, at: { x: state.pot.x, y: state.pot.y }, transform: { scale: POT_SCALE, rotate: state.pot.tilt } }),
    ...(state.hand.visible ? [Instance({ id: "hand", entityId: "host-hand", of: hand, data: null,
      attachTo: { instance: "pot", anchor: "grip" }, transform: { x: state.hand.x, y: state.hand.y } })] : []),
    ...(state.stream ? [Instance({ id: "stream", of: stream, data: state.stream,
      attachTo: { instance: "pot", anchor: "spout" }, transform: { rotate: -state.pot.tilt } })] : []),
    Instance({ id: "cup", entityId: "tea-bowl-1", of: cup, data: { edits: { ...teaEdits(state.tea.level, state.tea.ripple, state.tea.steam), ...steamEdits(state.seconds) } },
      at: CUP, transform: { scale: CUP_SCALE } }),
  );
}
