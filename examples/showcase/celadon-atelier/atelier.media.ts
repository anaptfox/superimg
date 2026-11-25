//! "Atelier, 4 pm" — native SVG still. Room + reusable prop documents placed
//! as Scene occurrences; per-occurrence edits only change declared targets.

import { Instance, Scene, svg, visual, svgPart, type SvgPaintEdit as SvgEdit } from "@foxworth/superimg";
import { atelierDoc, cupDoc, potDoc, shadowDoc, teaEdits, tinDoc, trivetDoc } from "./art.ts";

const room = visual<null>({ id: "atelier.room", render: () => ({ parts: [
  svgPart("interior", { document: atelierDoc, only: "room", band: 0 }),
  svgPart("foreground", { document: atelierDoc, only: "foreground-leaves", band: 20 }),
] }) });
const pot = visual<null>({ id: "celadon.pot", render: () => ({ parts: [svgPart("pot", { document: potDoc, band: 6 })] }) });
const trivet = visual<null>({ id: "iron.trivet", render: () => ({ parts: [svgPart("iron", { document: trivetDoc, band: 5 })] }) });
const shade = visual<{ strength: number }>({ id: "bench.shadow", render: ({ data }) => ({ parts: [svgPart("shade", { document: shadowDoc, band: 1,
  edits: { contact: { opacity: 0.6 * data.strength }, penumbra: { opacity: 0.4 * data.strength } } })] }) });
const tin = visual<{ edits: Record<string, SvgEdit>; band: number }>({ id: "tea.tin", render: ({ data }) => ({ parts: [svgPart("tin", { document: tinDoc, band: data.band, edits: data.edits })] }) });
const cup = visual<{ edits: Record<string, SvgEdit>; band: number }>({ id: "celadon.cup", render: ({ data }) => ({ parts: [
  svgPart("back", { document: cupDoc, only: "bowl-back", band: data.band, edits: data.edits }),
  svgPart("front", { document: cupDoc, only: "bowl-front", band: data.band + 1, edits: data.edits }),
  svgPart("steam", { document: cupDoc, only: "steam", band: 19, edits: data.edits }),
] }) });

const ivory: Record<string, SvgEdit> = {
  "cup-glaze": { fill: "url(#bowl-outer-ivory)" }, "bowl-interior": { fill: "url(#bowl-inner-ivory)" },
  "rim-back": { fill: "#cbbd9c" }, "rim-lip": { stroke: "#fffaf0" },
};
const tins: [string, number, number, number, Record<string, SvgEdit>][] = [
  ["tin-lapsang", 1196, 672, 1.0, { "tin-name": { text: "Lapsang" }, "tin-number": { text: "No. 7" } }],
  ["tin-sencha", 1282, 664, 0.86, { "tin-body": { fill: "url(#tin-celadon)" }, "tin-name": { text: "Sencha" }, "tin-number": { text: "No. 12" } }],
  ["tin-oolong", 1360, 680, 1.08, { "tin-body": { fill: "url(#tin-ink)" }, "tin-name": { text: "Oolong" }, "tin-number": { text: "No. 3" }, "label-rule": { stroke: "#3b2416" } }],
];

export function atelierScene(width = 1600, height = 1000) {
  const k = width / 1600;
  return Scene({ id: "atelier", width, height, camera: { x: 0, y: 0, zoom: k } },
    Instance({ id: "room", entityId: "atelier-room", of: room, data: null, at: { x: 0, y: 0 } }),
    Instance({ id: "pot-shadow", of: shade, data: { strength: 1 }, at: { x: 652, y: 806 }, transform: { scale: 1.35 } }),
    Instance({ id: "trivet", entityId: "trivet-1", of: trivet, data: null, at: { x: 660, y: 806 }, transform: { scale: 1.35 } }),
    Instance({ id: "pot", entityId: "teapot-1", of: pot, data: null, at: { x: 660, y: 806 - 14 * 1.35 }, transform: { scale: 1.3 } }),
    ...tins.map(([id, x, y, s, edits]) => [
      Instance({ id: `${id}-shadow`, of: shade, data: { strength: 0.9 }, at: { x: x - 6, y: y + 2 }, transform: { scaleX: s * 0.42, scaleY: s * 0.5 } }),
      Instance({ id, entityId: id, of: tin, data: { edits, band: 3 }, at: { x, y }, transform: { scale: s } }),
    ]).flat(),
    Instance({ id: "ivory-shadow", of: shade, data: { strength: 0.85 }, at: { x: 1094, y: 742 }, transform: { scaleX: 0.75, scaleY: 0.8 } }),
    Instance({ id: "ivory-cup", entityId: "tea-bowl-2", of: cup, data: { edits: { ...ivory, ...teaEdits(0) }, band: 7 }, at: { x: 1100, y: 740 }, transform: { scale: 1.3 } }),
    Instance({ id: "cup-shadow", of: shade, data: { strength: 1 }, at: { x: 990, y: 862 }, transform: { scaleX: 1.0, scaleY: 1.1 } }),
    Instance({ id: "cup", entityId: "tea-bowl-1", of: cup, data: { edits: teaEdits(0.8, 0, 0.9), band: 9 }, at: { x: 996, y: 860 }, transform: { scale: 1.65 } }),
  );
}

export default svg({ size: { width: 1600, height: 1000 }, fonts: [{ family: "Bricolage Grotesque", weight: 600, src: new URL("./assets/BricolageGrotesque.ttf", import.meta.url).pathname }], render: (ctx) => atelierScene(ctx.width, ctx.height) });
