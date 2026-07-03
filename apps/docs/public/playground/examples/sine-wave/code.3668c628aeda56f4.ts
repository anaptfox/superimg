import { define } from "superimg";

export default define({ medium: "svg",
  config: {
    width: 800,
    height: 400,
  },
  render(ctx) {
    const { std, width, height } = ctx;
    const coords = std.viz.createCoords({
      width,
      height,
      xRange: [-Math.PI * 2, Math.PI * 2],
      yRange: [-1.5, 1.5],
      padding: 40,
    });

    const gridLines = std.viz.grid(coords, { color: "#e5e7eb", strokeWidth: 0.5 });
    const axesLines = std.viz.axes(coords, { color: "#374151", strokeWidth: 1.5 });
    const sinePlot = std.viz.plot(coords, (x) => Math.sin(x), { color: "#3b82f6", strokeWidth: 2.5, samples: 200 });
    const cosPlot = std.viz.plot(coords, (x) => Math.cos(x), { color: "#ef4444", strokeWidth: 2, samples: 200 });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f9fafb"/>
  ${gridLines}
  ${axesLines}
  ${sinePlot}
  ${cosPlot}
  <text x="20" y="${height - 12}" font-family="system-ui,sans-serif" font-size="12" fill="#6b7280">
    sin(x) <tspan fill="#3b82f6">■</tspan>   cos(x) <tspan fill="#ef4444">■</tspan>
  </text>
</svg>`;
  },
});
