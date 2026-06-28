import { define } from "superimg";

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "5s",
    fonts: ["Inter:wght@600;800"],
  },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const cx = width / 2;
    const cy = height / 2;

    const t = ctx.director({ hook: "15%", draw: "70%", hold: "15%" });
    const angle = timeline.progress * Math.PI * 10;

    const trails: string[] = [];
    const bodies: string[] = [];
    const orbits = [
      { r: 120, speed: 1, color: "#5b8cff", size: 14 },
      { r: 200, speed: -0.62, color: "#f093fb", size: 10 },
      { r: 280, speed: 0.38, color: "#4fd1c5", size: 12 },
      { r: 360, speed: -0.24, color: "#ffc857", size: 9 },
    ];

    for (const o of orbits) {
      trails.push(
        `<circle cx="${cx}" cy="${cy}" r="${o.r}" fill="none" stroke="${std.color.alpha(o.color, 0.15)}" stroke-width="1.5" opacity="${std.interpolate(t.in("hook"), [0, 1], [0, 1], "easeOutCubic").toFixed(3)}"/>`,
      );

      const samples = 120;
      const trailParts: string[] = [];
      const trailLen = std.interpolate(t.in("draw"), [0, 1], [0.15, 1], "easeOutCubic");
      for (let i = 0; i <= samples; i++) {
        const frac = (i / samples) * trailLen;
        const a = angle * o.speed - frac * Math.PI * 3;
        const tx = cx + Math.cos(a) * o.r;
        const ty = cy + Math.sin(a) * o.r * 0.72;
        trailParts.push(`${i === 0 ? "M" : "L"} ${tx.toFixed(2)} ${ty.toFixed(2)}`);
      }
      trails.push(
        `<path d="${trailParts.join(" ")}" fill="none" stroke="${o.color}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`,
      );

      const bx = cx + Math.cos(angle * o.speed) * o.r;
      const by = cy + Math.sin(angle * o.speed) * o.r * 0.72;
      bodies.push(
        `<circle cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="${(o.size + 6).toFixed(1)}" fill="${o.color}" opacity="0.2"/>` +
          `<circle cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="${o.size}" fill="${o.color}"/>`,
      );
    }

    const corePulse = 1 + 0.08 * Math.sin(angle * 2);
    const titleOp = std.interpolate(t.in("hook"), [0, 1], [0, 1], "easeOutCubic");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="oBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0e1024"/>
      <stop offset="100%" stop-color="#040408"/>
    </radialGradient>
    <filter id="coreGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="24" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#oBg)"/>
  ${trails.join("\n")}
  <g filter="url(#coreGlow)">
    <circle cx="${cx}" cy="${cy}" r="${(36 * corePulse).toFixed(2)}" fill="#eef2ff" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="18" fill="#5b8cff"/>
  </g>
  ${bodies.join("\n")}
  <text x="90" y="90" font-family="Inter,sans-serif" font-size="24" font-weight="600" fill="#5b8cff" letter-spacing="6" opacity="${titleOp.toFixed(3)}">ORBITAL TRAILS</text>
  <text x="90" y="140" font-family="Inter,sans-serif" font-size="44" font-weight="800" fill="#f0f4ff" opacity="${titleOp.toFixed(3)}">Spirograph chaos</text>
</svg>`;
  },
});