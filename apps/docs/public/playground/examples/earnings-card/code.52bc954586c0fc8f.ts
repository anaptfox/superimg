import { define } from "superimg";

const REVENUE = [
  { label: "Q1", value: 42 },
  { label: "Q2", value: 58 },
  { label: "Q3", value: 71 },
  { label: "Q4", value: 88 },
];

const MIX = [
  { label: "SaaS", value: 52 },
  { label: "Services", value: 28 },
  { label: "License", value: 20 },
];

const PIE_COLORS = ["#5b8cff", "#4fd1c5", "#ffc857"];

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
    const t = ctx.director({ headline: "12%", charts: "73%", hold: "15%" });

    const frame = { x: 0, y: 0, width, height };
    const headlineBox = std.layout.inset(frame, { x: 80, y: 70, bottom: height - 200 });
    const fitted = std.svg.fitText("Q4 Earnings Snapshot", headlineBox, {
      fontFamily: "Inter",
      fontWeight: 700,
      maxSize: 72,
      minSize: 32,
    });

    const headlineLines = fitted.lines
      .map(
        (line, i) =>
          `<text x="${headlineBox.x}" y="${headlineBox.y + (i + 1) * fitted.fontSize * 1.1}" font-family="Inter,sans-serif" font-size="${fitted.fontSize}" font-weight="700" fill="#f0f4ff">${line.text}</text>`,
      )
      .join("\n");

    const chartArea = std.layout.inset(frame, { x: 80, y: 220, bottom: 80 });
    const [barCell, pieCell] = std.layout.grid(chartArea, { cols: 2, rows: 1, gap: 48 });
    const barPlot = std.layout.inset(barCell, { x: 24, y: 56, bottom: 24 });
    const piePlot = std.layout.inset(pieCell, { x: 24, y: 56, bottom: 24 });

    const barCoords = viz.createCoords({
      width: barPlot.width,
      height: barPlot.height,
      xRange: [0, REVENUE.length + 1],
      yRange: [0, 100],
      padding: { top: 20, bottom: 40, left: 50, right: 20 },
    });
    const barOffsetX = barPlot.x;
    const barOffsetY = barPlot.y;

    const chartP = t.in("charts");
    const headlineOp = t.in("headline");

    const barGrid = viz.grid(barCoords, { color: "#1e2640", ticks: 5, progress: chartP });
    const barAxes = viz.axes(barCoords, { color: "#3d4a68", ticks: 5, progress: chartP });
    const bars = viz.charts.bar(barCoords, REVENUE, {
      animate: "grow",
      progress: chartP,
      barRadius: 5,
      showLabels: true,
    });

    const pie = viz.charts.pie(MIX, {
      box: piePlot,
      outerRadius: Math.min(piePlot.width, piePlot.height) * 0.28,
      innerRadius: 40,
      progress: chartP,
      colors: PIE_COLORS,
      labels: { format: "percent", fontSize: 13 },
    });
    const legend = viz.charts.legend(
      { x: piePlot.x + piePlot.width * 0.58, y: piePlot.y + 40, width: 200, height: 200 },
      MIX.map((s) => ({ id: s.label, data: [s] })),
      { fontSize: 18, gap: 14, colors: PIE_COLORS },
    );

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <g opacity="${headlineOp.toFixed(3)}">${headlineLines}</g>
  <text x="80" y="200" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${(headlineOp * 0.9).toFixed(3)}">std.svg.fitText headline · layout.grid composite</text>
  <rect x="${barCell.x}" y="${barCell.y}" width="${barCell.width}" height="${barCell.height}" rx="14" fill="#0e1220" stroke="#5b8cff" stroke-width="2"/>
  <text x="${barCell.x + 24}" y="${barCell.y + 36}" font-family="Inter,sans-serif" font-size="20" font-weight="600" fill="#8b95b0">QUARTERLY REVENUE</text>
  <g transform="translate(${barOffsetX},${barOffsetY})" opacity="${chartP.toFixed(3)}">${barGrid}${barAxes}${bars}</g>
  <rect x="${pieCell.x}" y="${pieCell.y}" width="${pieCell.width}" height="${pieCell.height}" rx="14" fill="#0e1220" stroke="#4fd1c5" stroke-width="2"/>
  <text x="${pieCell.x + 24}" y="${pieCell.y + 36}" font-family="Inter,sans-serif" font-size="20" font-weight="600" fill="#8b95b0">REVENUE MIX</text>
  <g opacity="${chartP.toFixed(3)}">${pie}${legend}</g>
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">bar + pie in grid cells</text>
</svg>`;
  },
});