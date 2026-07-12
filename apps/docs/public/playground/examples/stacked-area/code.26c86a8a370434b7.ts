import { define } from "superimg";

const SERIES = [
  {
    id: "product",
    data: [
      { label: "Q1", value: 40 },
      { label: "Q2", value: 55 },
      { label: "Q3", value: 48 },
      { label: "Q4", value: 70 },
    ],
  },
  {
    id: "services",
    data: [
      { label: "Q1", value: 25 },
      { label: "Q2", value: 30 },
      { label: "Q3", value: 42 },
      { label: "Q4", value: 38 },
    ],
  },
  {
    id: "other",
    data: [
      { label: "Q1", value: 12 },
      { label: "Q2", value: 18 },
      { label: "Q3", value: 15 },
      { label: "Q4", value: 22 },
    ],
  },
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
    const { std, width, height } = ctx;
    const viz = std.viz;
    const t = ctx.director({ intro: "12%", grow: "70%", hold: "18%" });

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 3],
      yRange: [0, 150],
      padding: { top: 160, bottom: 100, left: 120, right: 100 },
    });

    const growP = t.in("grow");
    const gridEl = viz.grid(coords, { color: "#1e2640", ticks: 6, progress: t.in("intro") });
    const axesEl = viz.axes(coords, { color: "#3d4a68", ticks: 6, progress: t.in("intro") });
    const stackEl = viz.charts.stack(coords, SERIES, {
      mode: "area",
      animate: "grow",
      progress: growP,
      colors: ["#5b8cff", "#4fd1c5", "#f093fb"],
      fillOpacity: 0.9,
    });
    const legendEl = viz.charts.legend(
      { x: width - 280, y: 160, width: 200, height: 120 },
      SERIES,
      { colors: ["#5b8cff", "#4fd1c5", "#f093fb"] },
    );

    const titleOp = t.in("intro");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">STACKED AREA</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Revenue mix by quarter</text>
  ${gridEl}
  ${axesEl}
  ${stackEl}
  ${legendEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">viz.charts.stack · D3 geometry · director progress</text>
</svg>`;
  },
});
