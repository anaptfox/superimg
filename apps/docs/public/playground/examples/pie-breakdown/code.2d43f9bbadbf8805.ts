import { define } from "superimg";

const SEGMENTS = [
  { label: "Engineering", value: 38 },
  { label: "Design", value: 22 },
  { label: "Marketing", value: 18 },
  { label: "Sales", value: 14 },
  { label: "Ops", value: 8 },
];

const COLORS = ["#5b8cff", "#f093fb", "#4fd1c5", "#ffc857", "#667eea"];

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const t = ctx.director({ reveal: "70%", hold: "30%" });

    const cx = width * 0.38;
    const cy = height * 0.52;
    const pieEl = viz.charts.pie(SEGMENTS, {
      cx,
      cy,
      outerRadius: 200,
      innerRadius: 60,
      progress: t.in("reveal"),
      colors: COLORS,
      labels: { format: "both", fontSize: 16 },
    });

    const legendBox = { x: width * 0.62, y: height * 0.28, width: 320, height: 400 };
    const legendEl = viz.charts.legend(legendBox, SEGMENTS.map((s) => ({ id: s.label, data: [s] })), {
      fontSize: 22,
      swatchSize: 18,
      gap: 20,
      colors: COLORS,
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
    const legendOp = std.interpolate(t.in("reveal"), [0.3, 1], [0, 1], "easeOutCubic");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">PIE BREAKDOWN</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Budget allocation by team</text>
  ${pieEl}
  <g opacity="${legendOp.toFixed(3)}">${legendEl}</g>
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">viz.charts.pie · slice labels + legend</text>
</svg>`;
  },
});