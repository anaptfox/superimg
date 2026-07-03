import { define } from "superimg";

const PANELS = [
  { title: "Revenue", value: "$2.4M", delta: "+12.4%", color: "#5b8cff", spark: [12, 18, 15, 22, 28, 24, 32] },
  { title: "Active Users", value: "18.2K", delta: "+8.1%", color: "#4fd1c5", spark: [8, 10, 9, 14, 16, 15, 18] },
  { title: "Sessions", value: "94.7K", delta: "+3.2%", color: "#ffc857", spark: [40, 52, 48, 61, 58, 72, 68] },
  { title: "Conversion", value: "3.8%", delta: "+0.6pp", color: "#f093fb", spark: [2.1, 2.4, 2.8, 3.1, 3.4, 3.6, 3.8] },
];

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "4s",
    fonts: ["Inter:wght@400;600;700"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const t = ctx.director({ enter: "60%", hold: "40%" });

    const frame = { x: 0, y: 0, width, height };
    const body = std.layout.inset(frame, { x: 80, y: 120, bottom: 80 });
    const cells = std.layout.grid(body, { cols: 2, rows: 2, gap: 36 });

    const staggered = std.stagger(PANELS, t.in("enter"), { duration: "55%", from: "start" });

    const panels = cells.map((cell, i) => {
      const panel = std.layout.inset(cell, { x: 28, y: 28 });
      const sparkBox = std.layout.inset(cell, { x: 28, y: cell.height - 88, bottom: 28, right: 28 });
      const p = staggered[i]?.progress ?? 0;
      const op = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
      const y = std.interpolate(p, [0, 1], [24, 0], "easeOutCubic");
      const { title, value, delta, color, spark } = PANELS[i]!;
      const sparkEl = viz.charts.sparkline(sparkBox, spark, {
        color,
        progress: p,
        animate: "draw",
      });

      return `
  <g opacity="${op.toFixed(3)}" transform="translate(0,${y.toFixed(1)})">
    <rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" rx="16" fill="#0e1220" stroke="${color}" stroke-width="2.5"/>
    <rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="6" rx="3" fill="${color}" opacity="0.85"/>
    <text x="${panel.x}" y="${panel.y + 36}" font-family="Inter,sans-serif" font-size="22" font-weight="600" fill="#8b95b0" letter-spacing="2">${title.toUpperCase()}</text>
    <text x="${panel.x}" y="${panel.y + 96}" font-family="Inter,sans-serif" font-size="56" font-weight="700" fill="#f0f4ff">${value}</text>
    <text x="${panel.x + panel.width - 120}" y="${panel.y + 52}" font-family="Inter,sans-serif" font-size="18" font-weight="600" fill="${color}">${delta}</text>
    ${sparkEl}
  </g>`;
    });

    const titleOp = std.interpolate(timeline.progress, [0, 0.15, 0.9, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <text x="80" y="72" font-family="Inter,sans-serif" font-size="42" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Grid Dashboard</text>
  <text x="80" y="108" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${(titleOp * 0.9).toFixed(3)}">std.layout.grid · viz.charts.sparkline</text>
  ${panels.join("\n")}
</svg>`;
  },
});