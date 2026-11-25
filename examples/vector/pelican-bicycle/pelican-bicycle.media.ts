// Pelican Commute — a bicycle built from typed vector paths and groups.
// Scene time drives every transform; clouds drift continuously without wrapping.
import { define, h, Vector, vector, googleFont } from "@foxworth/superimg";

export default define({
  medium: "svg",
  poster: "4s",
  sample: {
    skyTop: "#87CEEB", skyBottom: "#E0F4FF", road: "#6B7280", grass: "#4ADE80",
    frameColor: "#F97316", wheelColor: "#1F2937", pelicanBody: "#F8FAFC",
    pelicanWing: "#CBD5E1", beakColor: "#FB923C", pouchColor: "#FDBA74",
  },
  config: { width: 1920, height: 1080, fps: 30, duration: "6s", fonts: [googleFont("Inter:wght@400;700")] },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const { skyTop, skyBottom, road, grass, frameColor, wheelColor, pelicanBody, pelicanWing, beakColor, pouchColor } = data;
    const t = ctx.director({ intro: "1.2s", ride: "4.0s", hold: "0.8s" });
    const groundY = height * 0.78;
    const rear = { x: width * 0.34, y: groundY - height * 0.096 };
    const front = { x: width * 0.62, y: rear.y };
    const crank = { x: width * 0.425, y: rear.y };
    const seat = { x: width * 0.385, y: groundY - height * 0.24 };
    const handle = { x: width * 0.585, y: groundY - height * 0.29 };
    const wheelR = height * 0.096;
    const wheelAngle = timeline.seconds / 1.4 * 360;
    const bob = Math.sin(timeline.seconds * Math.PI * 2 / 0.9) * height * 0.008;
    const travel = t.tween(0, width * 0.08, { id: "bike-travel", during: "ride", easing: "easeInOutSine" });
    const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, opacity = 1) =>
      vector.path({ d: std.svg.shape.circle(0, 0, 1), transform: { x, y, scaleX: rx, scaleY: ry }, fill, opacity });
    const line = (d: string, stroke: string, strokeWidth: number) =>
      vector.path({ d, fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" });
    const wheel = (id: string, hub: { x: number; y: number }) => vector.group({ id, transform: { x: hub.x, y: hub.y } },
      vector.path({ d: std.svg.shape.circle(0, 0, wheelR), fill: "none", stroke: wheelColor, strokeWidth: 7 }),
      vector.group({ id: `${id}-spokes`, transform: { rotate: wheelAngle } },
        ...[0, 45, 90, 135].map((angle) => vector.path({
          id: `${id}-spoke-${angle}`, d: `M${-wheelR * 0.83},0H${wheelR * 0.83}`,
          transform: { rotate: angle }, fill: "none", stroke: wheelColor, strokeWidth: 3,
        }))),
      ellipse(0, 0, 8, 8, frameColor),
    );
    const titleP = std.interpolate(t.in("intro"), [0, 0.7], [0, 1], "easeOutCubic");
    return Vector({ id: "pelican-commute", width, height, viewBox: { x: 0, y: 0, width, height } },
      vector.defs(
        h("linearGradient", { id: "sky", x1: 0, y1: 0, x2: 0, y2: 1 }, h("stop", { offset: "0%", "stop-color": skyTop }), h("stop", { offset: "100%", "stop-color": skyBottom })),
        h("linearGradient", { id: "road", x1: 0, y1: 0, x2: 0, y2: 1 }, h("stop", { offset: "0%", "stop-color": road }), h("stop", { offset: "100%", "stop-color": "#374151" })),
        h("filter", { id: "soft-shadow", x: "-20%", y: "-20%", width: "140%", height: "140%" }, h("feDropShadow", { dx: 0, dy: 4, stdDeviation: 6, "flood-color": "#000", "flood-opacity": 0.13 })),
      ),
      vector.path({ id: "sky-paint", d: `M0,0H${width}V${height}H0Z`, fill: "url(#sky)" }),
      ellipse(width * 0.2, groundY - height * 0.03, width * 0.12, height * 0.065, grass, 0.55),
      ellipse(width * 0.8, groundY - height * 0.015, width * 0.14, height * 0.075, grass, 0.45),
      vector.group({ id: "cloud-west", transform: { x: timeline.seconds * width * 0.02 }, opacity: 0.9 },
        ellipse(width * 0.15, height * 0.16, width * 0.028, height * 0.046, "#fff"),
        ellipse(width * 0.19, height * 0.135, width * 0.02, height * 0.04, "#fff"),
        ellipse(width * 0.12, height * 0.135, width * 0.016, height * 0.033, "#fff")),
      vector.group({ id: "cloud-east", transform: { x: -timeline.seconds * width * 0.015 }, opacity: 0.9 },
        ellipse(width * 0.75, height * 0.2, width * 0.032, height * 0.05, "#fff"),
        ellipse(width * 0.79, height * 0.18, width * 0.022, height * 0.043, "#fff"),
        ellipse(width * 0.72, height * 0.182, width * 0.018, height * 0.037, "#fff")),
      vector.path({ d: `M0,${groundY}H${width}V${height}H0Z`, fill: grass }),
      vector.path({ d: `M0,${groundY + height * 0.06}H${width}V${height}H0Z`, fill: "url(#road)" }),
      vector.path({ id: "road-dashes", d: `M0,${groundY + height * 0.12}H${width}`, fill: "none", stroke: "#FDE68A", strokeWidth: 5, strokeDasharray: "40 30", strokeDashoffset: timeline.seconds * 140, opacity: 0.85 }),
      vector.group({ id: "bicycle", transform: { x: travel }, filter: "soft-shadow" },
        wheel("rear-wheel", rear), wheel("front-wheel", front),
        line(`M${rear.x},${rear.y}L${crank.x},${crank.y}L${seat.x},${seat.y}L${handle.x},${handle.y}L${front.x},${front.y}M${crank.x},${crank.y}L${front.x},${front.y}`, frameColor, 8),
        line(`M${seat.x - 8},${seat.y + 4}Q${seat.x + 10},${seat.y + 18} ${seat.x + 28},${seat.y + 6}`, frameColor, 7),
        line(`M${handle.x},${handle.y}L${handle.x + 4},${handle.y - height * 0.07}M${handle.x - 22},${handle.y - height * 0.063}H${handle.x + 26}`, frameColor, 7),
        vector.group({ id: "pedals", transform: { x: crank.x, y: crank.y, rotate: wheelAngle } },
          line("M-26,0H26", frameColor, 6),
          vector.path({ d: std.svg.shape.roundedRect(-34, -7, 14, 14, 3), fill: "#111827" }),
          vector.path({ d: std.svg.shape.roundedRect(20, -7, 14, 14, 3), fill: "#111827" })),
      ),
      vector.group({ id: "pelican", filter: "soft-shadow", transform: { x: seat.x - width * 0.03 + travel, y: seat.y - height * 0.155 + bob, scale: height / 1080 } },
        vector.path({ d: "M10,95Q-30,80 -18,58Q-5,72 10,78Z", fill: pelicanWing }),
        ellipse(72, 88, 58, 48, pelicanBody), ellipse(88, 102, 42, 34, pelicanBody),
        vector.path({ d: "M48,72Q20,50 58,38Q95,55 88,78Z", fill: pelicanWing }),
        line("M52,74Q30,58 52,48", "#94A3B8", 2),
        vector.path({ d: "M108,70Q138,42 162,48Q176,52 170,66Q158,78 132,82Q118,84 108,70Z", fill: pelicanBody }),
        vector.path({ d: "M168,58L250,52Q258,56 252,64L176,70Z", fill: beakColor }),
        vector.path({ d: "M176,68Q210,92 198,112Q182,104 174,78Z", fill: pouchColor, stroke: beakColor, strokeWidth: 2 }),
        ellipse(166, 58, 5, 5, "#111827"), ellipse(168, 56, 1.8, 1.8, "#fff"),
        line("M78,128L70,150L58,158M96,130L104,152L118,160", beakColor, 5),
        vector.path({ d: "M128,78Q148,88 138,98Q126,92 120,82Z", fill: "#EF4444" }),
      ),
      vector.group({ id: "title", opacity: titleP, transform: { y: 18 * (1 - titleP) } },
        vector.text({ x: width / 2, y: height * 0.085, anchor: "middle", size: height * 0.046, weight: 700, fill: "#0F172A", family: "Inter" }, "Pelican Commute"),
        vector.text({ x: width / 2, y: height * 0.118, anchor: "middle", size: height * 0.022, fill: "#475569", family: "Inter" }, "A little motion, a better morning"),
      ),
    );
  },
});
