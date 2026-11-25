// Chapter I — the plate opens. Furniture rules out, then the title settles.
import { define, Vector, vector, googleFont } from "@foxworth/superimg";
import { BONE, GOLD, furniture, ground, skyDefs } from "./sky.js";

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
    title: "THE WINTER SKY",
    subtitle: "Eight stars, nine lines, one figure",
    plate: "PLATE I",
  },
  render(ctx) {
    const { std, width, height, data } = ctx;
    const t = ctx.director({ open: "34%", title: "34%", hold: "20%", exit: "12%" });

    const leave = std.interpolate(t.in("exit"), [0, 1], [0, 1], "easeInCubic");
    const ruleP = std.interpolate(t.in("open"), [0, 1], [0, 1], "easeOutCubic");

    // Title rises from behind a fixed rule; the subtitle follows a beat later.
    const titleP = std.interpolate(t.in("title"), [0, 0.7], [0, 1], "easeOutCubic");
    const subP = std.interpolate(t.in("title"), [0.35, 1], [0, 1], "easeOutCubic");
    const cx = width / 2;
    const baseY = height * 0.52;

    const size = 116;
    const titleY = baseY + std.interpolate(titleP, [0, 1], [size * 1.05, 0], "easeOutCubic");
    const markW = width * 0.16 * std.interpolate(subP, [0, 1], [0, 1], "easeOutCubic");

    return Vector(
      { id: "winter-sky-intro", width, height, viewBox: { x: 0, y: 0, width, height } },
      skyDefs(),
      vector.defs(vector.clip({ id: "title-clip" }, vector.path({
        d: `M0,${baseY - size * 1.25}H${width}V${baseY + 4}H0Z`, fill: "#fff",
      }))),
      ground(width, height, 7),
      furniture({ width, height, chapter: "CHAPTER I", plate: data.plate, ruleP, op: ruleP * (1 - leave) }),
      vector.group({ id: "title-lockup", opacity: 1 - leave },
        vector.group({ id: "title-reveal", clip: "title-clip" },
          vector.text({ x: cx, y: titleY, anchor: "middle", family: "Fraunces, Georgia, serif", size, weight: 600, fill: BONE, letterSpacing: 6 }, data.title)),
        markW > 0 ? vector.path({ d: `M${cx - markW},${baseY + 44}H${cx + markW}`, fill: "none", stroke: GOLD, strokeWidth: 1.6, opacity: 0.85 }) : null,
        vector.text({ x: cx, y: baseY + 100, anchor: "middle", family: "Inter, sans-serif", size: 26, fill: BONE, opacity: 0.65 * subP }, data.subtitle),
      ),
    );
  },
});
