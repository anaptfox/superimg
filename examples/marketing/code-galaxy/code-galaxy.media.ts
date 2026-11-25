import { video, Frame, NativeSurface, Stack, Text, googleFont } from "@foxworth/superimg";
import world from "./world.ts?superimg-surface";
import type { GalaxyFrame } from "./world.ts";

/**
 * 14,000 particles placed on a four-arm spiral — positions and colors are
 * pure functions of index + progress. Impossible to shoot: every frame is
 * mathematically exact, not motion-tracked footage.
 */
export default video({
  duration: "8s",
  fonts: [googleFont("JetBrains+Mono:wght@400;600"), googleFont("Inter:wght@400;600;700")],
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const tRaw = timeline.progress;
    // Anticipation: pull back slightly, then orbit the whole spiral from above.
    const t = std.interpolate(tRaw, [0, 0.15, 1], [0, -0.08, 1], "easeInOutSine");

    const theta = (t * 2 * Math.PI).toFixed(3);
    const radius = (10.5 - t * 1.2).toFixed(3);
    const particles = 14000;

    const hudOp = std.interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);
    const hudWidth = Math.min(width - 64, 800);

    return Frame(
      { id: "stage", width, height, fill: "#020208" },
      Frame({ width, height, style: { background: "radial-gradient(ellipse 90% 80% at 50% 50%, #0a0e24 0%, #020208 100%)" } },
        NativeSurface<GalaxyFrame>({ id: "galaxy", module: world, width, height, seconds: timeline.seconds, data: { progress: t } })),
      Frame({ id: "hud", x: 32, y: height - 238, width: hudWidth, height: 206, fill: "rgba(2,2,8,0.88)", style: { opacity: hudOp } },
        Frame({ x: 18, y: 18, width: hudWidth - 36, height: 170 }, Stack({ gap: 12, width: "fill" },
          Text({ id: "label", size: 22, letterSpacing: 3, color: "#5b8cff", weight: 600 }, "PARAMETRIC GALAXY"),
          Text({ id: "count", size: 32, weight: 600, color: "#c8d6ff" }, `Four spiral arms · ${std.text.formatNumber(particles)} particles`),
          Text({ id: "camera", size: 24, color: "#8b95b0", fontFamily: "'JetBrains Mono', monospace" }, `θ = ${theta} rad · camera r = ${radius} · t = ${timeline.seconds.toFixed(2)}s`),
          Text({ id: "note", size: 22, color: "#8b95b0", maxWidth: 740, lineHeight: 1.45 }, "Every star position comes from its index. Change one constant and render a new universe."),
        )),
      ),
    );
  },
});
