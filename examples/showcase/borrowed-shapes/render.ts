import { Fill, Frame, Stack, Text, Vector, vector, type MediaElement } from "@foxworth/superimg";
import { projectForms, type FormGrain, type GroundGrain, type FormsSnapshot } from "./model";

export const FORMS_PALETTE = { plum: "#170F20", bone: "#F3ECE2", lavender: "#8D829F", shadow: "#373044" };
const DEPTHS = 8, TONES = 24;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const PALETTE = Array.from({ length: TONES }, (_, index) => {
  const p = index / (TONES - 1);
  const from = p < .45 ? [55, 48, 68] : [141, 130, 159];
  const to = p < .45 ? [141, 130, 159] : [243, 236, 226];
  const q = p < .45 ? p / .45 : (p - .45) / .55;
  return `rgb(${from.map((c, i) => Math.round(mix(c, to[i]!, q))).join(",")})`;
});

export interface FormsView { width: number; height: number; teaching: boolean; followGrains: boolean; live?: boolean }
interface FacetStyle { rx: number; tail: string }
const STYLES = new Map<string, { grains: readonly FacetStyle[]; ground: readonly FacetStyle[] }>();
const MATERIAL_PATHS = new WeakMap<readonly FormGrain[], Map<string, readonly MediaElement[]>>();
const GROUND_PATHS = new WeakMap<readonly GroundGrain[], Map<string, readonly MediaElement[]>>();
function facetStyle(radius: number, seed: number): FacetStyle {
  const rx = radius * (.8 + seed * .4), ry = radius * (.65 + seed * .3);
  return { rx, tail: `l${rx.toFixed(2)},${(-ry).toFixed(2)}l${rx.toFixed(2)},${ry.toFixed(2)}l${(-rx).toFixed(2)},${ry.toFixed(2)}Z` };
}
function facet(x: number, y: number, style: FacetStyle): string {
  return `M${(x-style.rx).toFixed(2)},${y.toFixed(2)}${style.tail}`;
}
export interface FollowLabel { id: number; x: number; y: number; anchorX: number; anchorY: number; width: number; height: number }
/** Two balanced rails with stable sorting; leaders retain the exact followed position. */
export function layoutFollowLabels(snapshot: FormsSnapshot, width: number, height: number): readonly FollowLabel[] {
  const scale = Math.min(width / 1280, height / 720), cx = width * .605, cy = height * .785;
  const anchors = snapshot.followedIds.map(id => {
    const p = projectForms(snapshot.grains[id]!);
    return { id, anchorX: cx + p.x * scale, anchorY: cy + p.y * scale };
  }).sort((a, b) => a.anchorX - b.anchorX || a.id - b.id);
  const labels: FollowLabel[] = [];
  for (let side = 0; side < 2; side++) {
    const group = anchors.slice(side * 6, (side + 1) * 6).sort((a, b) => a.anchorY - b.anchorY || a.id - b.id);
    const x = cx + (side ? 296 : -306) * scale, spacing = 18 * scale;
    const ys = group.map(item => Math.max(height * .28, Math.min(height * .84, item.anchorY - 4 * scale)));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + spacing);
    if (ys.at(-1)! > height * .84) { ys[ys.length - 1] = height * .84; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - spacing); }
    group.forEach((anchor, i) => labels.push({ ...anchor, x, y: ys[i]!, width: 29 * scale, height: 10 * scale }));
  }
  return labels;
}
function ring(x: number, y: number, r: number): string { return `M${x-r},${y}a${r},${r} 0 1,0 ${r*2},0a${r},${r} 0 1,0 ${-r*2},0Z`; }

export function formsTeachingCaption(seconds: number): string {
  if (seconds < 6) return "Eighteen thousand grains acquire a seed.";
  if (seconds < 11) return "Five seed lobes become five primary limbs.";
  if (seconds < 14) return "The same core now carries a trunk.";
  if (seconds < 19) return "Limbs become towers. The trunk becomes a gate.";
  if (seconds < 22) return "Six semantic parts preserve their grain identities.";
  if (seconds < 27) return "The same grains return to their first positions.";
  return "The seed returns exactly. No material was replaced.";
}

/** Porcelain facets remain in stable depth/color buckets through each transport. */
export function renderForms(snapshot: FormsSnapshot, view: FormsView): MediaElement {
  const { width, height } = view;
  const scale = Math.min(width / 1280, height / 720);
  const cx = width * .605, cy = height * .785;
  const sizeKey = `${width}x${height}`;
  let styles = STYLES.get(sizeKey);
  if (!styles) {
    styles = { grains: snapshot.grains.map(grain => facetStyle(Math.max(.58, grain.radius * scale), grain.seed)), ground: snapshot.ground.map(grain => facetStyle(grain.radius * scale * .85, grain.seed)) };
    STYLES.set(sizeKey, styles);
  }
  let groundSizes = GROUND_PATHS.get(snapshot.ground);
  if (!groundSizes) { groundSizes = new Map(); GROUND_PATHS.set(snapshot.ground, groundSizes); }
  let groundPaths = groundSizes.get(sizeKey);
  if (!groundPaths) {
    const floor = Array.from({ length: 8 }, () => "");
    for (let id = 0; id < snapshot.ground.length; id++) {
      const grain = snapshot.ground[id]!; if (!grain.drawn) continue;
      const p = projectForms(grain), tone = Math.min(7, Math.floor(grain.seed * 8));
      floor[tone] += facet(cx + p.x * scale, cy + p.y * scale, styles.ground[id]!);
    }
    groundPaths = floor.map((d, index) => vector.path({ id: `forms-ground-${index}`, d: d || "M0,0h1v1h-1Z", fill: PALETTE[index + 1], opacity: d ? .56 : 0 }));
    groundSizes.set(sizeKey, groundPaths);
  }
  const cacheable = snapshot.from === snapshot.to;
  let grainSizes = cacheable ? MATERIAL_PATHS.get(snapshot.grains) : undefined;
  if (cacheable && !grainSizes) { grainSizes = new Map(); MATERIAL_PATHS.set(snapshot.grains, grainSizes); }
  let materialPaths = grainSizes?.get(sizeKey);
  if (!materialPaths) {
    const bins = Array.from({ length: DEPTHS * TONES }, () => "");
    for (const grain of snapshot.grains) {
      if (!grain.drawn) continue;
      const p = projectForms(grain);
      const diffuse = Math.max(0, -grain.nx * .45 + grain.ny * .77 - grain.nz * .38);
      const diffuseTone = clamp(.22 + diffuse * .72 + (grain.seed - .5) * .085);
      const tone = Math.min(TONES - 1, Math.floor(diffuseTone * TONES));
      const depth = Math.min(DEPTHS - 1, Math.floor(clamp((p.z + 245) / 560) * DEPTHS));
      bins[depth * TONES + tone] += facet(cx + p.x * scale, cy + p.y * scale, styles.grains[grain.id]!);
    }
    materialPaths = bins.map((d, index) => vector.path({ id: `forms-material-${index}`, d: d || "M0,0h1v1h-1Z", fill: PALETTE[index % TONES], opacity: d ? 1 : 0 }));
    grainSizes?.set(sizeKey, materialPaths);
  }
  const material = [...groundPaths, ...materialPaths];
  const follow: MediaElement[] = [];
  if (view.followGrains) for (const label of layoutFollowLabels(snapshot, width, height)) {
    const { id, x, y, anchorX, anchorY } = label;
    const endX = x < cx ? x + label.width + 3 * scale : x - 3 * scale;
    follow.push(vector.path({ id: `forms-follow-${id}`, d: ring(anchorX, anchorY, 4.8 * scale), fill: "none", stroke: "#DACAF0", strokeWidth: .8 * scale, opacity: .9 }));
    follow.push(vector.path({ id: `forms-follow-leader-${id}`, d: `M${anchorX},${anchorY}L${endX},${y-3*scale}`, fill: "none", stroke: "#DACAF0", strokeWidth: .45 * scale, opacity: .55 }));
    follow.push(vector.text({ id: `forms-follow-label-${id}`, x, y, fill: "#DACAF0", size: 8 * scale, family: "Inter", weight: 500, opacity: .9 }, String(id).padStart(5, "0")));
  }
  const formLabel = snapshot.to === "bed" ? "MATERIAL" : snapshot.to === "seed" ? "SEED" : snapshot.to === "tree" ? "TREE" : "CITADEL";
  const partNames = ["CORE", "LOBE I", "LOBE II", "LOBE III", "LOBE IV", "LOBE V"];
  return Frame({ id: "borrowed-shapes-stage", width, height },
    Fill({ id: "forms-plum", color: FORMS_PALETTE.plum }),
    Fill({ id: "forms-raking-stage", gradient: { kind: "radial", at: "61% 50%", size: "58% 64%", stops: ["#302439 0%", "#211629 58%", "#170F20 100%"] } }),
    Vector({ id: "forms-vector", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.path({ id: "forms-contact-shadow", d: `M${cx-230*scale},${cy+14*scale}Q${cx},${cy-24*scale} ${cx+230*scale},${cy+14*scale}Q${cx},${cy+52*scale} ${cx-230*scale},${cy+14*scale}Z`, fill: "#100A16", opacity: .64 }),
      ...material,
      ...follow,
    ),
    Frame({ id: "forms-heading", x: width * .08, y: height * .095, width: width * .62, height: 87 * scale },
      Stack({ width: "fill", gap: 9 * scale },
        Text({ id: "forms-study", size: 10 * scale, color: FORMS_PALETTE.lavender, weight: 500, fontFamily: "Inter", letterSpacing: 2.2 * scale }, "MATERIAL STUDIES / 03"),
        Text({ id: "forms-title", size: 31 * scale, color: FORMS_PALETTE.bone, weight: 500, fontFamily: "Inter", letterSpacing: -.65 * scale }, "Borrowed Shapes"),
        Text({ id: "forms-subtitle", size: 11 * scale, color: "#A093B0", fontFamily: "Inter" }, "One population. Several forms."),
      ),
    ),
    Frame({ id: "forms-form-label", x: width * .77, y: height * .105, width: width * .15, height: 32 * scale },
      Text({ id: "forms-current", size: 10 * scale, color: "#BDABC9", fontFamily: "Inter", weight: 500, align: "right", letterSpacing: 2 * scale }, formLabel),
    ),
    Frame({ id: "forms-parts-legend", x: width * .08, y: height * .385, width: width * .205, height: 170 * scale, style: { opacity: view.followGrains ? .9 : 0 } },
      Stack({ width: "fill", gap: 8 * scale },
        Text({ id: "forms-follow-title", size: 10 * scale, color: "#DACAF0", fontFamily: "Inter", weight: 500 }, "FOLLOW TWELVE IDENTITIES"),
        ...partNames.map((name, part) => Text({ id: `forms-part-label-${part}`, size: 9 * scale, color: "#B6A7C4", fontFamily: "Inter" }, `${name}  /  ${String(part * 3000).padStart(5, "0")} + ${String((part + 1) * 3000 - 1).padStart(5, "0")}`)),
      ),
    ),
    Frame({ id: "forms-caption-box", x: width * .1, y: height * .87, width: width * .8, height: 26 * scale, style: { opacity: view.teaching ? 1 : 0 } },
      Text({ id: "forms-caption", size: 14 * scale, color: FORMS_PALETTE.bone, fontFamily: "Inter", weight: 400, align: "center" }, formsTeachingCaption(snapshot.seconds)),
    ),
    Frame({ id: "forms-count-box", x: width * .08, y: height * .925, width: width * .5, height: 20 * scale, style: { opacity: 1 } },
      Text({ id: "forms-count", size: 10 * scale, color: "#8D829F", fontFamily: "Inter", letterSpacing: .4 * scale }, "18,000 transported / six parts / 1,600 ground"),
    ),
    Frame({ id: "forms-clock-box", x: width * .82, y: height * .925, width: width * .1, height: 20 * scale, style: { opacity: view.teaching || view.live ? 1 : 0 } },
      Text({ id: "forms-clock", size: 10 * scale, color: "#8D829F", fontFamily: "Inter", align: "right" }, `${snapshot.seconds.toFixed(1)} / 30 s`),
    ),
  );
}
