// Three States — a cyanotype specimen plate where one silhouette becomes the next.
// Water, leaf, flame are sampled from the same 72-point grid, so every morph is
// segment-matched by construction instead of by luck.
import { define, Vector, vector, type MediaElement, googleFont } from "@foxworth/superimg";

const PRUSSIAN = "#0E2E4C";
const PRUSSIAN_LIT = "#17527D";
const BONE = "#EDE6D3";

const DURATION = 12;
const SAMPLES = 72;

type StateId = "water" | "leaf" | "flame";

/**
 * Each state is a half-width profile plus a centreline, sampled tip→base down
 * the right flank and base→tip up the left. `front`/`back` set where the shape
 * is widest: low for a drop, mid for a leaf, upper-mid for a flame.
 */
const PROFILE: Record<
  StateId,
  { top: number; bottom: number; half: number; front: number; back: number; lean: number }
> = {
  water: { top: -0.92, bottom: 0.92, half: 0.62, front: 1.6, back: 0.5, lean: 0 },
  leaf: { top: -1, bottom: 1, half: 0.4, front: 1, back: 1, lean: 0 },
  flame: { top: -1.34, bottom: 0.96, half: 0.5, front: 1.3, back: 0.75, lean: 0.34 },
};

function outline(kind: StateId, cx: number, cy: number, s: number): { x: number; y: number }[] {
  const { top, bottom, half, front, back, lean } = PROFILE[kind];
  // Normalise so `half` is the true half-width wherever the profile peaks.
  const peak = front / (front + back);
  const norm = Math.pow(peak, front) * Math.pow(1 - peak, back);
  const flank = SAMPLES / 2;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const side = i < flank ? 1 : -1;
    const v = i < flank ? i / flank : (SAMPLES - i) / flank; // 0 at tip, 1 at base
    const w = (half / norm) * Math.pow(v, front) * Math.pow(1 - v, back);
    const centre = lean * (Math.pow(1 - v, 2.2) - 0.3 * Math.sin(Math.PI * v));
    pts.push({
      x: cx + (centre + side * w) * s,
      y: cy + (top + v * (bottom - top)) * s,
    });
  }
  return pts;
}

export default define({
  medium: "svg",
  poster: "8.6s",
  sample: {
    plate: "PLATE IV",
    archive: "CYANOTYPE · 1843",
    states: [
      { numeral: "I", name: "WATER", note: "water expands as it freezes" },
      { numeral: "II", name: "LEAF", note: "light, water, and the architecture of a leaf" },
      { numeral: "III", name: "FLAME", note: "a shifting contour, held for a moment" },
    ],
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: `${DURATION}s`,
    fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({
      plate: "8%",
      water: "20%",
      toLeaf: "10%",
      leaf: "18%",
      toFlame: "10%",
      flame: "22%",
      hold: "12%",
    });

    const cx = width / 2;
    const cy = height * 0.468;
    const scale = height * 0.238;

    const paths = (["water", "leaf", "flame"] as const).map((k) =>
      std.svg.bezier.smooth(outline(k, cx, cy, scale), 0.5, true),
    );

    // A single 0→2 position through the specimen sequence. Holds are integers;
    // fractions are the morphs.
    const ease = (p: number) => std.interpolate(p, [0, 1], [0, 1], "easeInOutCubic");
    let k = 0;
    if (t.in("hold") > 0 || t.in("flame") > 0) k = 2;
    else if (t.in("toFlame") > 0) k = 1 + ease(t.in("toFlame"));
    else if (t.in("leaf") > 0) k = 1;
    else if (t.in("toLeaf") > 0) k = ease(t.in("toLeaf"));

    const lo = Math.min(1, Math.floor(k));
    const frac = k - lo;
    const specimen =
      frac <= 0.0001 ? paths[lo]! : std.svg.morph(paths[lo]!, paths[lo + 1]!, frac);

    // The plate exposes and holds the last specimen for a readable ending.
    const arrive = std.interpolate(t.in("water"), [0, 0.42], [0, 1], "easeOutCubic");
    const bodyOp = arrive;
    const bodyScale = std.interpolate(arrive, [0, 1], [0.94, 1], "easeOutCubic");

    // Veins are the payoff of the leaf hold: ink drawn onto a settled shape.
    const veinP = std.interpolate(t.in("leaf"), [0.1, 0.72], [0, 1], "easeOutCubic");
    const leafness = std.clamp01(1 - Math.abs(k - 1) / 0.34);
    const veins: MediaElement[] = [];
    if (leafness > 0.01 && veinP > 0.01) {
      const midrib = `M${cx},${(cy - scale * 0.94).toFixed(2)} L${cx},${(cy + scale * 0.94).toFixed(2)}`;
      const ribs: string[] = [midrib];
      for (let i = 0; i < 8; i++) {
        const f = -0.62 + (i / 7) * 1.24;
        const y0 = cy + f * scale;
        const side = i % 2 === 0 ? 1 : -1;
        const reach = (0.42 - Math.abs(f) * 0.34) * scale;
        ribs.push(
          `M${cx},${y0.toFixed(2)} Q${(cx + side * reach * 0.6).toFixed(2)},${(y0 + scale * 0.06).toFixed(2)} ${(cx + side * reach).toFixed(2)},${(y0 + scale * 0.16).toFixed(2)}`,
        );
      }
      const drawn = std.svg.drawMany(ribs, veinP, { lag: 0.12, easing: "easeOutCubic" });
      ribs.forEach((d, i) => {
        const w = i === 0 ? 3 : 1.8;
        veins.push(vector.path({
          id: `leaf-vein-${i}`,
          d,
          fill: "none",
          stroke: PRUSSIAN,
          strokeWidth: w,
          strokeLinecap: "round",
          opacity: 0.4 * leafness,
          strokeDasharray: drawn[i]!.strokeDasharray,
          strokeDashoffset: drawn[i]!.strokeDashoffset,
        }));
      });
    }

    // Captions cross-fade around the morph so the silhouette is never rivalled.
    const captions = data.states.flatMap((s, i) => {
        const op = std.clamp01(1 - Math.abs(k - i) / 0.42) * arrive;
        if (op <= 0.01) return [];
        const y = height * 0.845;
        return [vector.group(
          { id: `state-caption-${i}`, opacity: op },
          vector.text(
            {
              x: cx,
              y,
              anchor: "middle",
              family: "Fraunces, Georgia, serif",
              size: 44,
              weight: 600,
              fill: BONE,
              letterSpacing: 10,
            },
            `${s.numeral} · ${s.name}`,
          ),
          vector.text(
            {
              x: cx,
              y: y + 44,
              anchor: "middle",
              family: "Inter, sans-serif",
              size: 22,
              fill: BONE,
              opacity: 0.62,
            },
            s.note,
          ),
        )];
      });

    // Plate furniture rules out from the centre, then retracts on the close.
    const ruleP = std.interpolate(t.in("plate"), [0, 1], [0, 1], "easeOutCubic");
    const m = 76;
    const innerM = 96;
    const furnitureOp = ruleP;

    const canvas = `M0,0H${width}V${height}H0Z`;
    const frame = `M${m},${m}H${width - m}V${height - m}H${m}Z`;

    return Vector(
      { id: "specimen-plate", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.path({ id: "cyanotype-ground", d: canvas, fill: PRUSSIAN }),
      vector.path({
        id: "exposure-wash",
        d: std.svg.shape.circle(cx, height * 0.44, width * 0.52),
        fill: PRUSSIAN_LIT,
        opacity: 0.56,
      }),
      vector.group(
        { id: "plate-furniture", opacity: furnitureOp },
        vector.path({ d: frame, fill: "none", stroke: BONE, strokeWidth: 1.6, opacity: 0.5 }),
        vector.path({
          id: "plate-rule-top",
          d: `M${innerM},${innerM}H${width - innerM}`,
          fill: "none",
          stroke: BONE,
          strokeWidth: 1,
          pathLength: 1,
          strokeDasharray: 1,
          strokeDashoffset: 1 - ruleP,
          opacity: 0.3,
        }),
        vector.path({
          id: "plate-rule-bottom",
          d: `M${innerM},${height - innerM}H${width - innerM}`,
          fill: "none",
          stroke: BONE,
          strokeWidth: 1,
          pathLength: 1,
          strokeDasharray: 1,
          strokeDashoffset: 1 - ruleP,
          opacity: 0.3,
        }),
        vector.text(
          {
            x: innerM + 8,
            y: m + 46,
            family: "Inter, sans-serif",
            size: 20,
            weight: 600,
            fill: BONE,
            letterSpacing: 7,
            opacity: 0.75,
          },
          data.plate,
        ),
        vector.text(
          {
            x: width - innerM - 8,
            y: m + 46,
            anchor: "end",
            family: "Inter, sans-serif",
            size: 20,
            weight: 600,
            fill: BONE,
            letterSpacing: 7,
            opacity: 0.5,
          },
          data.archive,
        ),
      ),
      vector.group(
        {
          id: "specimen",
          opacity: bodyOp,
          transform: { scale: bodyScale, originX: cx, originY: cy },
        },
        vector.path({
          id: "specimen-halo",
          d: specimen,
          fill: BONE,
          opacity: 0.4,
          style: { filter: "blur(16px)" },
        }),
        vector.path({ id: "specimen-body", d: specimen, fill: BONE, opacity: 0.94 }),
        ...veins,
      ),
      ...captions,
    );
  },
});
