import { define } from "superimg";

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
    const { std, width, height } = ctx;
    const t = ctx.director({ frame: "20%", shapes: "55%", hold: "25%" });
    const rough = std.svg.rough;

    // Stable topology + fixed seeds — animate opacity/draw, don't re-rough morphing geometry
    const frame = rough.rect(120, 100, width - 240, height - 200, {
      seed: 11,
      stroke: "#5b8cff",
      strokeWidth: 2,
      roughness: 1.3,
      bowing: 1.2,
    });
    const card = rough.rect(width / 2 - 280, height / 2 - 160, 560, 320, {
      seed: 22,
      fill: "#1e293b",
      fillStyle: "hachure",
      stroke: "#94a3b8",
      strokeWidth: 1.5,
      roughness: 1.1,
    });
    const blob = rough.circle(width / 2, height / 2 + 20, 90, {
      seed: 33,
      fill: "#5b8cff",
      fillStyle: "cross-hatch",
      stroke: "#93c5fd",
      roughness: 1.4,
    });
    const accent = rough.line(width / 2 - 200, height / 2 + 140, width / 2 + 200, height / 2 + 140, {
      seed: 44,
      stroke: "#f093fb",
      strokeWidth: 3,
      roughness: 1.6,
    });

    const frameOp = t.in("frame");
    const shapesOp = t.in("shapes");
    const holdOp = t.in("hold");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0b1020"/>
  <g opacity="${frameOp.toFixed(3)}">${frame}</g>
  <g opacity="${shapesOp.toFixed(3)}">${card}${blob}${accent}</g>
  <text x="${width / 2}" y="90" text-anchor="middle" font-family="Inter,sans-serif" font-size="42" font-weight="700" fill="#f0f4ff" opacity="${frameOp.toFixed(3)}">Rough sketch marks</text>
  <text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" fill="#6b7795" opacity="${holdOp.toFixed(3)}">std.svg.rough · seeded · pure SVG paths</text>
</svg>`;
  },
});
