import { define } from "superimg";

const POINTS = [
  { x: 2, y: 14, label: "A" },
  { x: 4, y: 22 },
  { x: 5, y: 18 },
  { x: 7, y: 35 },
  { x: 8, y: 28 },
  { x: 10, y: 42 },
  { x: 12, y: 38 },
  { x: 14, y: 55 },
  { x: 16, y: 48 },
  { x: 18, y: 62 },
  { x: 20, y: 58 },
  { x: 22, y: 71 },
];

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const t = ctx.director({ grid: "10%", plot: "50%", trend: "35%", hold: "5%" });

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 24],
      yRange: [0, 80],
      padding: { top: 160, bottom: 100, left: 120, right: 80 },
    });

    const gridEl = viz.grid(coords, { color: "#1e2640", ticks: 6, progress: t.in("grid") });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 6, progress: t.in("grid") });
    const scatterEl = viz.charts.scatter(coords, POINTS, [0, 24], [0, 80], {
      progress: t.in("plot"),
      showPointLabels: true,
      trendLine: { progress: t.in("trend"), color: "#ffc857", strokeWidth: 3 },
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">SCATTER PLOT</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Correlation with regression reveal</text>
  ${gridEl}
  ${axesEl}
  ${scatterEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("trend").toFixed(3)}">viz.charts.scatter · trendLine after pause</text>
</svg>`;
  },
});