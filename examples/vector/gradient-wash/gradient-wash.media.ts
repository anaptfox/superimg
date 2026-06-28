import { define } from "superimg";

const STOPS_A = [
  { offset: 0, color: "#5b8cff" },
  { offset: 0.4, color: "#667eea" },
  { offset: 1, color: "#0a0a1a" },
];

const STOPS_B = [
  { offset: 0, color: "#f093fb" },
  { offset: 0.55, color: "#ffc857" },
  { offset: 1, color: "#1a1028" },
];

const STOPS_C = [
  { offset: 0, color: "#4fd1c5" },
  { offset: 0.35, color: "#5b8cff" },
  { offset: 0.7, color: "#667eea" },
  { offset: 1, color: "#080810" },
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
    const t = ctx.director({ linear: "40%", radial: "40%", hold: "20%" });

    const linearMorph = t.in("linear");
    const radialMorph = t.in("radial");
    const holdOp = std.interpolate(t.in("hold"), [0, 1], [0.85, 1], "easeOutCubic");

    const angle = 120 + linearMorph * 160;
    const linearGrad = std.svg.gradient.animate(STOPS_A, STOPS_B, linearMorph, "linear", { angle });
    const radialGrad = std.svg.gradient.animate(STOPS_B, STOPS_C, radialMorph, "radial", {
      cx: `${45 + radialMorph * 10}%`,
      cy: `${38 - radialMorph * 8}%`,
      r: `${50 + radialMorph * 25}%`,
    });

    const linearOp = std.interpolate(linearMorph, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
    const radialOp = std.interpolate(radialMorph, [0, 0.2, 1], [0, 1, 1]);
    const showRadial = radialMorph > 0.01;

    const titleOp = std.interpolate(timeline.progress, [0, 0.12, 0.88, 1], [0, 1, 1, 0]);
    const labelOp = std.interpolate(timeline.progress, [0.15, 0.35], [0, 1], "easeOutCubic");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${linearGrad.defs}
    ${radialGrad.defs}
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <rect width="${width}" height="${height}" fill="${linearGrad.fill}" opacity="${(linearOp * holdOp).toFixed(3)}"/>
  ${showRadial ? `<rect width="${width}" height="${height}" fill="${radialGrad.fill}" opacity="${(radialOp * holdOp).toFixed(3)}"/>` : ""}
  <g filter="url(#softGlow)" opacity="${titleOp.toFixed(3)}">
    <text x="${width / 2}" y="${height * 0.42}" text-anchor="middle" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#8b95b0" letter-spacing="10">GRADIENT WASH</text>
    <text x="${width / 2}" y="${height * 0.5}" text-anchor="middle" font-family="Inter,sans-serif" font-size="64" font-weight="700" fill="#f0f4ff">Linear → Radial morph</text>
  </g>
  <text x="${width / 2}" y="${height * 0.58}" text-anchor="middle" font-family="Inter,sans-serif" font-size="22" fill="#a5b4d4" opacity="${labelOp.toFixed(3)}">std.svg.gradient.animate · animateGradientStops</text>
</svg>`;
  },
});