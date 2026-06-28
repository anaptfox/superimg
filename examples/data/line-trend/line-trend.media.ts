import { define } from "superimg";

const TREND = [
  { label: "Jan", value: 22 },
  { label: "Feb", value: 35 },
  { label: "Mar", value: 28 },
  { label: "Apr", value: 48 },
  { label: "May", value: 42 },
  { label: "Jun", value: 61 },
  { label: "Jul", value: 55 },
  { label: "Aug", value: 72 },
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
    const t = ctx.director({ grid: "12%", draw: "73%", hold: "15%" });

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, TREND.length - 1],
      yRange: [0, 80],
      padding: { top: 160, bottom: 100, left: 120, right: 80 },
    });

    const drawP = t.in("draw");
    const gridEl = viz.grid(coords, { color: "#1e2640", ticks: 8, progress: t.in("grid") });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 8, progress: t.in("grid") });
    const lineEl = viz.charts.line(coords, TREND, {
      fill: true,
      animate: "draw",
      progress: drawP,
      colors: ["#5b8cff"],
      showLabels: true,
      showPoints: true,
      pointRadius: 6,
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">LINE TREND</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Monthly growth trajectory</text>
  ${gridEl}
  ${axesEl}
  ${lineEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">viz.charts.line · accurate path draw</text>
</svg>`;
  },
});