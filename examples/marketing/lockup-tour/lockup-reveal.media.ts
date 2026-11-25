import { video, Frame, Fill, Vector, vector, googleFont } from "@foxworth/superimg";
import { CREAM, INK, bar, geom, ringLeft, ringRight } from "./mark";

export default video({
  duration: "6s",
  size: { width: 1080, height: 1080 },
  fonts: [googleFont("Fraunces:wght@600")],
  render(ctx) {
    const { width, height, std } = ctx;
    const g = geom(width, height);
    const t = ctx.director({ draw: "42%", mark: "28%", hold: "30%" });
    const rings = [ringLeft(g.cx, g.cy, g.r), ringRight(g.cx, g.cy, g.r)];
    const drawn = std.svg.drawMany(rings, t.in("draw"), { lag: 1, easing: "easeOutCubic" });
    const barPath = bar(g.cx, g.cy, g.r);
    const barDraw = std.svg.draw(barPath, t.in("mark"));
    const letters = std.spring(0, 1, t.in("mark"), "snappy");

    return Frame(
      { id: "stage", width, height },
      Fill({ color: CREAM }),
      Vector({ id: "lockup", width, height, viewBox: { x: 0, y: 0, width, height } },
        ...rings.map((d, i) => vector.path({
          id: `ring-${i}`, d, fill: "none", stroke: INK,
          strokeWidth: g.r * 0.14, strokeLinecap: "square",
          strokeDasharray: drawn[i]?.strokeDasharray ?? 0,
          strokeDashoffset: drawn[i]?.strokeDashoffset ?? 0,
        })),
        vector.path({ id: "bar", d: barPath, fill: "none", stroke: INK, strokeWidth: g.r * 0.14,
          strokeDasharray: barDraw.strokeDasharray, strokeDashoffset: barDraw.strokeDashoffset }),
        vector.text({ id: "wordmark", x: g.cx, y: g.wordY, anchor: "middle", fill: INK,
          family: "Fraunces, Palatino, Georgia, serif", size: g.size * 0.055,
          weight: 600, letterSpacing: "0.42em", opacity: std.clamp01(letters) }, "SUPERIMG"),
      ),
    );
  },
});
