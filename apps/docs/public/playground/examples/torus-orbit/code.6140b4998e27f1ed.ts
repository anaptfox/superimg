import { define } from "superimg";

const TRACE = "#ffc857";
const ACCENT = "#5b8cff";

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
    const t = ctx.director({ draw: "70%", hold: "30%" });

    const R = 1.3;
    const r = 0.42;
    const uSteps = 120;
    const orbitPhase = timeline.progress * Math.PI * 2;

    const ring: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= uSteps; i++) {
      const u = (i / uSteps) * Math.PI * 2;
      ring.push({
        x: (R + r * Math.cos(orbitPhase)) * Math.cos(u),
        y: (R + r * Math.cos(orbitPhase)) * Math.sin(u),
        z: r * Math.sin(orbitPhase),
      });
    }

    const drawP = t.in("draw");

    const fullPath = viz.project3d.path3d(ring, "perspective", {
      camera: { azimuth: 25 + timeline.progress * 140, elevation: 26, distance: 4.2 },
      scale: 140,
      offsetX: width / 2,
      offsetY: height * 0.5,
    });
    const draw = std.svg.draw(fullPath, drawP);

    const titleOp = std.interpolate(timeline.progress, [0, 0.12, 0.88, 1], [0, 1, 1, 0]);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#12182a"/>
      <stop offset="100%" stop-color="#06060f"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="${width / 2}" cy="${height * 0.5}" r="180" fill="none" stroke="${std.color.alpha(ACCENT, 0.08)}" stroke-width="1"/>
  <path d="${fullPath}" fill="none" stroke="${TRACE}" stroke-width="3.5" stroke-linecap="round" filter="url(#glow)"
    stroke-dasharray="${draw.strokeDasharray}" stroke-dashoffset="${draw.strokeDashoffset}"/>
  <text x="90" y="100" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="${ACCENT}" letter-spacing="6" opacity="${titleOp.toFixed(3)}">TORUS ORBIT</text>
  <text x="90" y="155" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Parametric ring in 3D</text>
  <text x="90" y="210" font-family="Inter,sans-serif" font-size="20" fill="#6b7795" opacity="${(titleOp * 0.85).toFixed(3)}">viz.project3d.path3d · perspective camera</text>
</svg>`;
  },
});