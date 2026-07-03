import { define } from "superimg";

const ACCENT = "#5b8cff";

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
    const t = ctx.director({ intro: "15%", spin: "70%", hold: "15%" });

    const verts = viz.project3d.cubeVertices(1.8);
    const edgeIdx = viz.project3d.cubeEdges();
    const edges = edgeIdx.map(([a, b]) => [verts[a]!, verts[b]!] as const);

    const azimuth = std.interpolate(t.in("spin"), [0, 1], [30, 390], "easeInOutSine");
    const elevation = 18 + Math.sin(timeline.progress * Math.PI * 2) * 6;

    const wire = viz.project3d.wireframe(edges, "perspective", {
      camera: { azimuth, elevation, distance: 4.8, fov: 42 },
      scale: 130,
      offsetX: width / 2,
      offsetY: height * 0.52,
      color: ACCENT,
      strokeWidth: 2.2,
    });

    const titleOp = t.in("intro");
    const captionOp = std.interpolate(t.in("hold"), [0, 1], [0, 1], "easeOutCubic");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="48%" r="50%">
      <stop offset="0%" stop-color="${std.color.alpha(ACCENT, 0.12)}"/>
      <stop offset="100%" stop-color="#06060f"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#06060f"/>
  <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>
  <g opacity="${std.interpolate(t.in("spin"), [0, 0.1], [0, 1]).toFixed(3)}">${wire}</g>
  <text x="90" y="100" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="${ACCENT}" letter-spacing="6" opacity="${titleOp.toFixed(3)}">WIREFRAME CUBE</text>
  <text x="90" y="155" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Rotating 3D projection</text>
  <text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" fill="#6b7795" letter-spacing="3" opacity="${captionOp.toFixed(3)}">viz.project3d · cubeVertices · wireframe · azimuth ${azimuth.toFixed(0)}°</text>
</svg>`;
  },
});