// Chapter III — the line is human. Edges draw on belt-first, then the names
// land on the stars they belong to.
import { define, Vector, vector, googleFont } from "@foxworth/superimg";
import {
  ASTERISM,
  BONE,
  GOLD,
  ORION,
  chartBox,
  circle,
  furniture,
  ground,
  place,
  skyDefs,
  starColor,
  starRadius,
} from "./sky.js";

const DURATION = 6.5;

export default define({
  medium: "svg",
  poster: "5.2s",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: `${DURATION}s`,
    fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  },
  sample: {
    stars: ORION,
    figure: "ORION",
    caption: "The stars are unrelated. The hunter is ours.",
    plate: "PLATE III",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ trace: "42%", name: "24%", hold: "22%", exit: "12%" });

    const leave = std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");
    const box = chartBox(width, height);
    const unit = box.w * 0.02;
    const byId = new Map(data.stars.map((s) => [s.id, s]));

    const edges = ASTERISM.map(([a, b]) => {
      const sa = byId.get(a);
      const sb = byId.get(b);
      if (!sa || !sb) return "";
      const pa = place(sa, box);
      const pb = place(sb, box);
      return `M${pa.x.toFixed(2)},${pa.y.toFixed(2)} L${pb.x.toFixed(2)},${pb.y.toFixed(2)}`;
    }).filter(Boolean);

    const drawn = std.svg.drawMany(edges, t.in("trace"), { lag: 0.4, easing: "easeOutCubic" });
    const lineEls = edges.map((d, i) => {
      const r = drawn[i]!;
      // Skip unstarted edges so round caps cannot leave dots on the plate.
      if (Number(r.strokeDashoffset) >= Number(r.strokeDasharray) - 0.01) return null;
      return vector.path({ id: `asterism-edge-${i}`, d, fill: "none", stroke: GOLD, strokeWidth: 2, strokeLinecap: "round", opacity: 0.62, ...r });
    });

    const starEls = data.stars.map((s, i) => {
      const pos = place(s, box);
      const r = starRadius(s.mag, unit);
      const live = s.mag < 1 ? 1 + 0.05 * Math.sin(timeline.seconds * 2.2 + i) : 1;
      return vector.group({ id: `star-${s.id}`, transform: { x: pos.x, y: pos.y, scale: live } },
        vector.path({ d: circle(0, 0, r * 2.6), fill: starColor(s.hue), opacity: 0.16 }),
        vector.path({ d: circle(0, 0, r), fill: starColor(s.hue) }),
      );
    });

    // Names cascade after the figure exists, so they annotate rather than compete.
    const namePs = std.stagger.ms(data.stars.length, t.in("name"), {
      windowSeconds: DURATION * 0.24,
      eachMs: 55,
      capMs: 440,
      from: "start",
    });
    const labelEls = data.stars.map((s, i) => {
      const p = std.clamp01(namePs[i] ?? 0);
      if (p <= 0.01) return null;
      const pos = place(s, box);
      const gap = starRadius(s.mag, unit) + 16;
      const anchor = s.lx > 0 ? "start" : s.lx < 0 ? "end" : "middle";
      const slide = std.interpolate(p, [0, 1], [(s.lx || 1) * -10, 0], "easeOutCubic");
      const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic") * 0.85;
      return vector.text({ id: `label-${s.id}`, x: pos.x + s.lx * gap + slide, y: pos.y + s.ly * 18 + 7,
        anchor, family: "Inter, sans-serif", size: 21, fill: BONE, opacity: op }, `${s.bayer} ${s.name}`);
    });

    const figureP = std.interpolate(t.in("name"), [0.5, 1], [0, 1], "easeOutCubic");
    const capP = std.interpolate(t.in("hold"), [0, 0.5], [0, 1], "easeOutCubic");

    return Vector(
      { id: "winter-sky-asterism", width, height, viewBox: { x: 0, y: 0, width, height } },
      skyDefs(), ground(width, height, 7),
      furniture({ width, height, chapter: "CHAPTER III · ASTERISM", plate: data.plate, ruleP: 1, op: 1 - leave }),
      vector.group({ id: "asterism-study", opacity: 1 - leave },
        ...lineEls,
        vector.group({ id: "stars", filter: "bloom" }, ...starEls),
        ...labelEls,
        vector.text({ id: "figure", x: width / 2, y: height - 132, anchor: "middle", family: "Fraunces, Georgia, serif", size: 40, weight: 600, fill: GOLD, letterSpacing: 16, opacity: figureP }, data.figure),
        vector.text({ id: "caption", x: width / 2, y: height - 96, anchor: "middle", family: "Inter, sans-serif", size: 22, fill: BONE, opacity: 0.55 * capP }, data.caption),
      ),
    );
  },
});
