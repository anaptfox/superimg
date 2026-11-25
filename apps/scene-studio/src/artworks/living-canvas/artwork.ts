import type { SceneCameraPatch } from "@foxworth/superimg/interactive/define";
import { defineArtwork } from "../../kit/artwork";
import livingCanvas from "./living-canvas.media";
import {
  livingCanvasProfiles,
  livingCanvasRenderer,
  type LivingCanvasSurfaceId,
} from "./renderer";

export const LIVING_CANVAS_ACTS = [
  {
    id: "encounter",
    numeral: "01",
    label: "Encounter",
    note: "A wallet waits in the rain.",
    focus: "wallet",
  },
  {
    id: "inventory",
    numeral: "02",
    label: "Inventory",
    note: "Money. An address. A photograph.",
    focus: "wallet.contents",
  },
  {
    id: "temptation",
    numeral: "03",
    label: "Temptation",
    note: "Value is easy to count.",
    focus: "money",
  },
  {
    id: "recognition",
    numeral: "04",
    label: "Recognition",
    note: "A life is harder.",
    focus: "family-photo",
  },
  {
    id: "return",
    numeral: "05",
    label: "Return",
    note: "The map tilts toward someone else.",
    focus: "address",
  },
  {
    id: "afterimage",
    numeral: "06",
    label: "Afterimage",
    note: "Meaning changed the picture.",
    focus: "decision",
  },
] as const;

export type LivingCanvasActId = (typeof LIVING_CANVAS_ACTS)[number]["id"];

export const LIVING_CANVAS_SURFACES = [
  { id: "nocturne", label: "Nocturne", swatch: "#ff7759" },
  { id: "letterpress", label: "Letterpress", swatch: "#c64c32" },
  { id: "blueprint", label: "Blueprint", swatch: "#49dfff" },
] as const satisfies ReadonlyArray<{
  id: LivingCanvasSurfaceId;
  label: string;
  swatch: string;
}>;

export const LIVING_CANVAS_ROLE_FILTERS = [
  { role: "evidence", label: "evidence" },
  { role: "option", label: "options" },
  { role: "lighting", label: "lighting" },
  { role: "narration", label: "narration" },
] as const;

export const RESET_CAMERA: SceneCameraPatch = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
  fit: null,
  follow: null,
};

const REQUIRED_NODES = [
  "wallet.shell",
  "wallet.contents",
  "money",
  "family-photo",
  "address",
  "owner",
  "owner.home",
  "keep-path",
  "return-path",
  "caption.encounter",
  "caption.inventory",
  "caption.temptation",
  "caption.recognition",
  "caption.return",
  "caption.afterimage",
] as const;

export const livingCanvasArtwork = defineArtwork({
  id: "living-canvas",
  template: livingCanvas,
  renderer: livingCanvasRenderer,
  acts: LIVING_CANVAS_ACTS,
  surfaces: LIVING_CANVAS_SURFACES,
  roleFilters: LIVING_CANVAS_ROLE_FILTERS,
  defaultSurface: "nocturne",
  editions: [
    { id: "landscape", label: "Landscape edition", glyph: "▰", width: 1440, height: 960 },
    { id: "square", label: "Square edition", glyph: "■", width: 1080, height: 1080 },
    { id: "portrait", label: "Portrait edition", glyph: "▯", width: 1080, height: 1920 },
  ],
  defaultEdition: "landscape",
  resetCamera: RESET_CAMERA,
  surfaceCss: livingCanvasProfiles,
  requiredNodes: REQUIRED_NODES,
  exclusiveParent: "caption",
  meta: {
    title: "The Weight of a Choice",
    eyebrow: "Interactive artwork · semantic scene no. 01",
    synopsis:
      "One scene. Six readings. Every object keeps its meaning while state, camera, and surface change around it.",
    description:
      "A rain-dark street contains a found wallet, cash, an address, a family photograph, two possible paths, and the distant owner. Story controls reveal how the same visual scene changes when its semantic focus changes.",
  },
});
