import { define } from "superimg";

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5s",
    fonts: ["Inter:wght@600"],
  },
  sample: {
    colors: ["#667eea", "#f093fb", "#4fd1c5", "#ffc857"],
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const cx = width / 2;
    const cy = height / 2;
    const r = 220;

    // polygon(10) and star(5) both normalize to 10 vertices — safe for std.svg.morph.
    const decagon = std.svg.shape.polygon(cx, cy, r, 10);
    const starA = std.svg.shape.star(cx, cy, r * 1.12, r * 0.48, 5);
    const starB = std.svg.shape.star(cx, cy, r * 0.95, r * 0.28, 5);
    const shapes = [
      { path: decagon, color: data.colors[0], label: "DECAGON" },
      { path: starA, color: data.colors[1], label: "STAR" },
      { path: starB, color: data.colors[2], label: "BURST" },
      { path: decagon, color: data.colors[3], label: "DECAGON" },
    ];

    const seg = 1 / shapes.length;
    const idx = Math.min(shapes.length - 1, Math.floor(timeline.progress / seg));
    const localP = (timeline.progress - idx * seg) / seg;
    const next = shapes[(idx + 1) % shapes.length]!;
    const current = shapes[idx]!;

    const morphT = std.interpolate(localP, [0, 0.7, 1], [0, 1, 1], "easeInOutCubic");
    const path = idx === shapes.length - 1 && localP > 0.85
      ? current.path
      : std.svg.morph(current.path, next.path, morphT);
    const color = std.interpolateColor(morphT, [0, 1], [current.color, next.color]);
    const rot = timeline.progress * 120;
    const pulse = 1 + 0.04 * Math.sin(timeline.progress * Math.PI * 6);

    const t = ctx.director({ enter: "20%", hold: "60%", exit: "20%" });
    const labelOp = std.interpolate(t.in("enter"), [0, 1], [0, 0.85], "easeOutCubic");

    const particles: string[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + timeline.progress * 0.8;
      const pr = 320 + 40 * Math.sin(i * 1.7 + timeline.progress * 5);
      const px = cx + Math.cos(a) * pr;
      const py = cy + Math.sin(a) * pr * 0.6;
      const pop = std.interpolate(timeline.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
      particles.push(
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(2 + (i % 3)).toFixed(1)}" fill="${color}" opacity="${(0.25 * pop).toFixed(3)}"/>`,
      );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="mBg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#141428"/>
      <stop offset="100%" stop-color="#06060f"/>
    </radialGradient>
    <filter id="morphGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#mBg)"/>
  ${particles.join("\n")}
  <g transform="rotate(${rot.toFixed(2)} ${cx} ${cy}) translate(${cx} ${cy}) scale(${pulse.toFixed(4)}) translate(${-cx} ${-cy})" filter="url(#morphGlow)">
    <path d="${path}" fill="${color}" opacity="0.88"/>
    <path d="${path}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.25"/>
  </g>
  <text x="${cx}" y="${height - 80}" text-anchor="middle" font-family="Inter,sans-serif" font-size="22" font-weight="600" fill="#a8b0c8" letter-spacing="10" opacity="${labelOp.toFixed(3)}">${current.label} → ${next.label}</text>
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" fill="#667eea" letter-spacing="5" opacity="${labelOp.toFixed(3)}">SHAPE MORPH</text>
</svg>`;
  },
});