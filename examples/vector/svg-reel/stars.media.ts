// Chapter II — only the points. Stars arrive brightest first, so magnitude,
// not layout, is what teaches the eye where to look.
import { define, Vector, vector, googleFont } from "@foxworth/superimg";
import {
  BONE,
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

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5.5s",
    fonts: [googleFont("Fraunces:wght@600"), googleFont("Inter:wght@400;600")],
  },
  sample: {
    stars: ORION,
    caption: "Brightest first — Rigel leads at magnitude 0.13",
    plate: "PLATE II",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ arrive: "44%", read: "40%", exit: "16%" });

    const leave = std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");
    const box = chartBox(width, height);
    const unit = box.w * 0.02;

    // Catalogue order is already brightest-first, so a plain stagger reads as
    // a magnitude cascade.
    const ps = std.stagger.ms(data.stars.length, t.in("arrive"), {
      windowSeconds: 5.5 * 0.44,
      eachMs: 90,
      capMs: 640,
      from: "start",
    });

    const els = data.stars.map((s, i) => {
      const p = std.clamp01(ps[i] ?? 0);
      if (p <= 0.001) return null;
      const pos = place(s, box);
      const r = starRadius(s.mag, unit);
      const pop = std.spring(0, 1, p, "snappy");
      // Only the two brightest keep a live twinkle; the rest hold still.
      const live = s.mag < 1 ? 1 + 0.05 * Math.sin(timeline.seconds * 2.2 + i) : 1;
      const scale = pop * live;
      const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      return vector.group({ id: `star-${s.id}`, transform: { x: pos.x, y: pos.y, scale }, opacity: op },
        vector.path({ d: circle(0, 0, r * 2.6), fill: starColor(s.hue), opacity: 0.16 }),
        vector.path({ d: circle(0, 0, r), fill: starColor(s.hue) }),
      );
    });

    const capP = std.interpolate(t.in("arrive"), [0.55, 1], [0, 1], "easeOutCubic");

    return Vector(
      { id: "winter-sky-stars", width, height, viewBox: { x: 0, y: 0, width, height } },
      skyDefs(), ground(width, height, 7),
      furniture({ width, height, chapter: "CHAPTER II · MAGNITUDE", plate: data.plate, ruleP: 1, op: 1 - leave }),
      vector.group({ id: "magnitude-study", opacity: 1 - leave },
        vector.group({ id: "stars", filter: "bloom" }, ...els),
        vector.text({ id: "caption", x: width / 2, y: height - 108, anchor: "middle", family: "Inter, sans-serif", size: 24, fill: BONE, opacity: 0.6 * capP }, data.caption),
      ),
    );
  },
});
