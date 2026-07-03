import { define } from "superimg";

const NODES = [
  { id: "api", label: "API" },
  { id: "db", label: "Database" },
  { id: "cache", label: "Cache" },
  { id: "auth", label: "Auth" },
  { id: "cdn", label: "CDN" },
  { id: "worker", label: "Worker" },
];

const LINKS = [
  { source: "api", target: "db" },
  { source: "api", target: "cache" },
  { source: "api", target: "auth" },
  { source: "cdn", target: "api" },
  { source: "worker", target: "db" },
  { source: "worker", target: "cache" },
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
    const t = ctx.director({ intro: "15%", settle: "70%", hold: "15%" });

    const plot = std.layout.inset({ x: 0, y: 0, width, height }, { x: 120, y: 180, bottom: 100, right: 120 });
    const graphEl = viz.charts.force(plot, NODES, LINKS, timeline, {
      progress: t.in("settle"),
      showLabels: true,
      linkDistance: 120,
      chargeStrength: -280,
      colors: ["#5b8cff", "#4fd1c5", "#ffc857", "#f093fb", "#667eea", "#ef4444"],
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">FORCE GRAPH</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Service dependency map</text>
  ${graphEl}
  <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${t.in("hold").toFixed(3)}">viz.charts.force · d3-force</text>
</svg>`;
  },
});