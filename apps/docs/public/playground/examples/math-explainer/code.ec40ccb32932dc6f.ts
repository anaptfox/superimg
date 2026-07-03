import { define } from "superimg";

export default define({
  config: {
    width: 1920,
    height: 1080,
    duration: "6s",
    fps: 30,
    background: "#0f172a",
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const p = timeline.progress;
    const coords = std.viz.createCoords({
      width,
      height,
      xRange: [-2 * Math.PI, 2 * Math.PI],
      yRange: [-1.8, 1.8],
      padding: 80,
    });

    const t = std.viz.tracker(timeline.progress, {
      grid:  [0.00, 0.15],
      axes:  [0.10, 0.35],
      curve: [0.30, 0.70],
      vec:   [0.60, 0.85],
      label: [0.75, 1.00],
    });

    return `
      <div style="${std.css.fill()}">
        <svg width="${width}" height="${height}" style="position:absolute;inset:0">
          ${std.viz.grid(coords, { color: "#1e293b", progress: t.grid })}
          ${std.viz.axes(coords, { color: "#475569", progress: t.axes })}
          ${std.viz.plot(coords, x => Math.sin(x), { color: "#4a9eff", strokeWidth: 3, progress: t.curve })}
          ${std.viz.vectorFrom(coords, Math.PI / 2, 1, { color: "#f97316", label: "peak", progress: t.vec })}
          ${std.viz.point(coords, -Math.PI / 2, -1, { label: "−1", color: "#a78bfa", radius: 7, progress: t.vec })}
        </svg>
        <div style="position:absolute;bottom:60px;left:0;right:0;display:flex;justify-content:center;opacity:${t.label}">
          ${std.viz.katex.equation("f(x) = \\sin(x)", { displayMode: true, fontSize: 36, color: "white" })}
        </div>
      </div>
    `;
  },
});
