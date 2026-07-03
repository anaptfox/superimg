import { define } from "superimg";

const BREAKDOWN = [
  { label: "Engineering", value: 42 },
  { label: "Design", value: 18 },
  { label: "Marketing", value: 22 },
  { label: "Sales", value: 28 },
  { label: "Support", value: 14 },
  { label: "Ops", value: 16 },
];

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
    const t = ctx.director({ intro: "20%", grow: "65%", hold: "15%" });

    const plot = std.layout.inset({ x: 0, y: 0, width, height }, { x: 120, y: 180, bottom: 100, right: 120 });
    const treemapEl = viz.charts.treemap(plot, BREAKDOWN, {
      progress: t.in("grow"),
      showLabels: true,
      colors: ["#5b8cff", "#4fd1c5", "#ffc857", "#f093fb", "#667eea", "#ef4444"],
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">TREEMAP</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Team allocation breakdown</text>
  ${treemapEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">viz.charts.treemap · d3-hierarchy</text>
</svg>`;
  },
});