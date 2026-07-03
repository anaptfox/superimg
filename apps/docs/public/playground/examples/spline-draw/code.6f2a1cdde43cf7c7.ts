import { define } from "superimg";

const STROKE = "#5b8cff";
const GLOW = "#ffc857";

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
    const t = ctx.director({ reveal: "75%", hold: "25%" });

    const points = [
      { x: width * 0.1, y: height * 0.72 },
      { x: width * 0.22, y: height * 0.28 },
      { x: width * 0.36, y: height * 0.62 },
      { x: width * 0.5, y: height * 0.22 },
      { x: width * 0.64, y: height * 0.58 },
      { x: width * 0.78, y: height * 0.3 },
      { x: width * 0.9, y: height * 0.48 },
    ];

    const splinePath = std.svg.bezier.smooth(points, 0.55, false);
    const drawP = std.interpolate(t.in("reveal"), [0, 1], [0, 1], "easeInOutCubic");
    const draw = std.svg.draw(splinePath, drawP);

    const dotCount = points.length;
    const dots = points
      .map((p, i) => {
        const threshold = (i + 0.5) / dotCount;
        const visible = drawP >= threshold - 0.08;
        const pop = visible
          ? std.interpolate(Math.min(1, (drawP - threshold + 0.08) / 0.12), [0, 1], [0, 1], "easeOutBack")
          : 0;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(6 * pop).toFixed(2)}" fill="${GLOW}" opacity="${pop.toFixed(3)}"/>`;
      })
      .join("\n");

    const titleOp = std.interpolate(timeline.progress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#12182a"/>
      <stop offset="100%" stop-color="#06060f"/>
    </radialGradient>
    <filter id="strokeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g opacity="0.12">
    ${points.map((p, i) => `<line x1="${points[Math.max(0, i - 1)]!.x}" y1="${points[Math.max(0, i - 1)]!.y}" x2="${p.x}" y2="${p.y}" stroke="${STROKE}" stroke-width="1" stroke-dasharray="4 8"/>`).join("\n")}
  </g>
  ${dots}
  <path d="${splinePath}" fill="none" stroke="${STROKE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
    stroke-dasharray="${draw.strokeDasharray}" stroke-dashoffset="${draw.strokeDashoffset}" filter="url(#strokeGlow)"/>
  <text x="90" y="100" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="${STROKE}" letter-spacing="6" opacity="${titleOp.toFixed(3)}">SPLINE DRAW</text>
  <text x="90" y="155" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Smooth curve stroke reveal</text>
  <text x="90" y="210" font-family="Inter,sans-serif" font-size="20" fill="#6b7795" opacity="${(titleOp * 0.8).toFixed(3)}">std.svg.bezier.smooth + std.svg.draw</text>
</svg>`;
  },
});