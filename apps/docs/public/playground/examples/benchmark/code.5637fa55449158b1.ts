// Benchmark Bars — viz.charts.barHorizontal
// Performance comparison chart

const BENCHMARKS = [
  { label: "Our Tool", value: 150 },
  { label: "Competitor A", value: 89 },
  { label: "Competitor B", value: 67 },
  { label: "Legacy", value: 23 },
];

import { define } from "superimg";
export default define({
  medium: "svg",
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const progress = Math.min(1, timeline.progress * 2);
    const maxVal = Math.max(...BENCHMARKS.map((b) => b.value));

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, maxVal],
      yRange: [0, BENCHMARKS.length],
      padding: { top: 100, bottom: 60, left: 160, right: 100 },
    });

    const barsEl = viz.charts.barHorizontal(coords, BENCHMARKS, {
      animate: "grow",
      progress,
      colors: ["#10b981", "#6366f1", "#8b5cf6", "#64748b"],
      showLabels: true,
      showValueLabels: true,
      barRadius: 6,
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0f172a"/>
  <text x="80" y="64" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="#ffffff">Performance Benchmark (ops/sec)</text>
  ${barsEl}
</svg>`;
  },
});