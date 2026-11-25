import type { Item } from "./kit";
import { capsule, circle, poly, rect, stroke, ticks } from "./kit";
import type { Era } from "./treat";

export type World = Era & {
  /** How much of the set exists in this world, 1..4. */
  level: number;
  /** Colours the performer's action lines and contact shadow borrow from the world. */
  fx: string;
  shadow: string;
};

/** Set pieces at a growth level. Everything sits behind the performer. */
export function stage(level: number, gloss = false): Item[] {
  const items: Item[] = [{ id: "sun", role: "sun", shape: circle(80, -166, 22) }];
  if (level >= 4) items.push(...ticks("ray", 80, -166, 20, 340, 9, 30, 38, 3, 1).map(i => ({ ...i, role: "ray" })));
  if (level >= 3) {
    items.push(
      { id: "cloud", role: "cloud", shape: capsule(-74, -164, 58, 20) },
      { id: "cloud-top", role: "cloud", shape: circle(-66, -174, 14), flat: true },
      { id: "cloud-side", role: "cloud", shape: circle(-88, -170, 10), flat: true },
    );
  }
  if (level >= 4) items.push({ id: "cloud-far", role: "cloud", shape: capsule(8, -190, 36, 12), opacity: 0.8 });
  if (level >= 2) {
    items.push(
      { id: "hill-far", role: "hill2", shape: poly([[18, 0], [50, -40], [84, -60], [114, -46], [130, -32], [130, 0]], [0, 16, 22, 16, 0, 0]) },
      { id: "hill-near", role: "hill1", shape: poly([[-130, 0], [-130, -54], [-98, -84], [-62, -68], [-30, -30], [-4, 0]], [0, 0, 26, 20, 14, 0]) },
    );
  }
  if (level >= 3) {
    items.push(
      { id: "pole", role: "pole", line: 3.2, shape: stroke([[96, -52], [96, -100]]) },
      { id: "flag", role: "flag", shape: poly([[96, -100], [122, -91], [96, -82]], [0, 3, 0]) },
    );
  }
  items.push({ id: "floor", role: "floor", shape: rect(-140, -2, 280, 62) });
  if (level >= 4) {
    items.push(
      { id: "floor-mark-l", role: "ray", line: 3, shape: stroke([[-112, 26], [-84, 26]]) },
      { id: "floor-mark-r", role: "ray", line: 3, shape: stroke([[70, 34], [110, 34]]) },
    );
  }
  if (gloss) {
    items.push(
      { id: "gloss-sun", role: "gloss", shape: capsule(72, -176, 16, 7), flat: true, opacity: 0.55 },
      ...(level >= 2 ? [{ id: "gloss-hill", role: "gloss", shape: capsule(-92, -68, 30, 8), flat: true, opacity: 0.3 } as Item] : []),
    );
  }
  // Prefixed so a set and a performer can share one document.
  return items.map(item => ({ ...item, id: `set-${item.id}` }));
}

export const worlds: World[] = [
  {
    id: "pixel", label: "Pixel beginnings", when: "A", note: "Forty cells across. A floor and a sun.",
    treatment: "pixel", level: 1, bg: "#2b3a67", line: "#141a33", lineWidth: 0, fps: 12, opts: { grid: 6.5 },
    fx: "#f7f3ea", shadow: "#141a33",
    palette: { sun: "#f5c84b", ray: "#f5c84b", cloud: "#8fa6e6", hill1: "#3f5aa8", hill2: "#5b7bd6", pole: "#f7f3ea", flag: "#ee5420", floor: "#1d2748", gloss: "#ffffff" },
  },
  {
    id: "flat", label: "Flat and graphic", when: "B", note: "Ink line, spot colour, a plate that slips. Hills arrive.",
    treatment: "flat", level: 2, bg: "#e6d6b8", line: "#17140f", lineWidth: 3.2, fps: 12, shade: ["hill1", "floor"],
    opts: { misregister: [2.5, -1.5] },
    fx: "#17140f", shadow: "#a89a7c",
    palette: { sun: "#f7f3ea", ray: "#17140f", cloud: "#f7f3ea", hill1: "#7f95ff", hill2: "#b9c5ff", pole: "#17140f", flag: "#ee5420", floor: "#cbbf9f", gloss: "#ffffff" },
  },
  {
    id: "glossy", label: "Glossy and tactile", when: "C", note: "Gradients and highlights. Weather and a flag.",
    treatment: "clean", level: 3, bg: "#1c1c1c", line: "#1c1c1c", lineWidth: 0, fps: 60,
    fx: "#f7f3ea", shadow: "#000000",
    palette: {
      sun: { grad: ["#fff0b8", "#f5c84b"], angle: 70 }, ray: "#f5c84b", cloud: { grad: ["#ffffff", "#bfc6e6"], angle: 90 },
      hill1: { grad: ["#5a72ff", "#1f33c9"], angle: 80 }, hill2: { grad: ["#8fa0ff", "#3a52e6"], angle: 80 },
      pole: "#d6d0c2", flag: { grad: ["#ffa066", "#ee5420"], angle: 40 }, floor: { grad: ["#34343a", "#121212"], angle: 90 }, gloss: "#ffffff",
    },
  },
  {
    id: "soft", label: "Soft and modern", when: "D", note: "The world is finally made of what the performer is made of.",
    treatment: "toy", level: 4, bg: "#efe3d0", line: "#2a1208", lineWidth: 0, fps: 60, opts: { lip: 4, jitter: 0.9 },
    fx: "#8a2a0e", shadow: "#b89f7c",
    palette: {
      sun: { grad: ["#ffe2a0", "#f5c84b"] }, ray: "#e0a92e", cloud: { grad: ["#ffffff", "#ece4d6"] },
      hill1: { grad: ["#9fb4ff", "#7088ee"] }, hill2: { grad: ["#c6d1ff", "#a3b3f5"] },
      pole: "#8a2a0e", flag: { grad: ["#ff8a5c", "#ee5420"] }, floor: { grad: ["#e3d3b8", "#d2bf9f"] }, gloss: "#ffffff",
    },
  },
];

/** A plain stage for looking at the performer alone. */
export const studio = { bg: "#e9e2d3", fx: "#17140f", shadow: "#b5ab95" };
export const studioDark = { bg: "#1c1c1c", fx: "#f7f3ea", shadow: "#000000" };

/** The performer's own paint, with the action-line and shadow colours of where it stands. */
export function dressed(skin: Era, place: { fx: string; shadow: string }): Era {
  return { ...skin, palette: { ...skin.palette, fx: place.fx, shadow: place.shadow } };
}
