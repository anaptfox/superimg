// Chapter IV — the colophon. The plate closes on the belt alone.
import { define, Vector, vector, googleFont } from "@foxworth/superimg";
import {
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

const BELT = ["alnitak", "alnilam", "mintaka"];

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "3.5s",
    fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  },
  sample: {
    headline: "Drawn without a browser",
    detail: "resvg · compose · deterministic frames",
    plate: "COLOPHON",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ settle: "40%", read: "44%", hold: "16%" });

    const arrive = std.interpolate(t.in("settle"), [0, 1], [0, 1], "easeOutCubic");
    const box = chartBox(width, height);
    const unit = box.w * 0.02;

    // The belt drifts up into the colophon: three stars, one rule, one line.
    const beltY = height * 0.4;
    const belt = BELT.map((id) => ORION.find((s) => s.id === id)).filter(
      (s): s is (typeof ORION)[number] => Boolean(s),
    );
    const beltEls = belt.map((s, i) => {
      const from = place(s, box);
      const to = { x: width / 2 + (i - 1) * 96, y: beltY };
      const x = from.x + (to.x - from.x) * arrive;
      const y = from.y + (to.y - from.y) * arrive;
      const r = starRadius(s.mag, unit);
      const live = 1 + 0.04 * Math.sin(timeline.seconds * 2 + i);
      return vector.group({ id: `belt-${s.id}`, transform: { x, y, scale: live } },
        vector.path({ d: circle(0, 0, r * 2.6), fill: starColor(s.hue), opacity: 0.16 }),
        vector.path({ d: circle(0, 0, r), fill: starColor(s.hue) }),
      );
    });

    const readP = std.interpolate(t.in("read"), [0, 0.45], [0, 1], "easeOutCubic");
    const headY = height * 0.58;
    const rise = std.interpolate(arrive, [0, 1], [26, 0], "easeOutCubic");
    const ruleW = width * 0.13 * readP;

    return Vector(
      { id: "winter-sky-colophon", width, height, viewBox: { x: 0, y: 0, width, height } },
      skyDefs(), ground(width, height, 7),
      furniture({ width, height, chapter: "THE WINTER SKY", plate: data.plate, ruleP: 1, op: arrive }),
      vector.group({ id: "belt", filter: "bloom" }, ...beltEls),
      ruleW > 0 ? vector.path({ d: `M${width / 2 - ruleW},${beltY + 78}H${width / 2 + ruleW}`, fill: "none", stroke: GOLD, strokeWidth: 1.4, opacity: 0.7 }) : null,
      vector.text({ id: "headline", x: width / 2, y: headY + rise, anchor: "middle", family: "Fraunces, Georgia, serif", size: 64, weight: 600, fill: BONE, opacity: arrive }, data.headline),
      vector.text({ id: "detail", x: width / 2, y: headY + 58 + rise, anchor: "middle", family: "Inter, sans-serif", size: 23, fill: BONE, letterSpacing: 3, opacity: 0.55 * readP }, data.detail),
    );
  },
});
