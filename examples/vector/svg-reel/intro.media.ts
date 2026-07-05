import { define } from "superimg";

const BG = "#06060f";
const ACCENT = "#5b8cff";
const GOLD = "#ffc857";

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "3s",
    fonts: ["Inter:wght@400;600;800"],
  },
  sample: { title: "VECTOR REEL", subtitle: "browser-free SVG composition" },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ enter: "55%", hold: "30%", exit: "15%" });

    const gridLines: string[] = [];
    const spacing = 72;
    const drift = timeline.progress * spacing;
    for (let x = -spacing; x < width + spacing; x += spacing) {
      const offset = ((x + drift) % (spacing * 2)) / (spacing * 2);
      const alpha = 0.04 + 0.06 * Math.sin(offset * Math.PI);
      gridLines.push(
        `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${height}" stroke="${ACCENT}" stroke-width="1" opacity="${alpha.toFixed(3)}"/>`,
      );
    }
    for (let y = 0; y < height; y += spacing) {
      gridLines.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${ACCENT}" stroke-width="1" opacity="0.035"/>`,
      );
    }

    const letters = data.title.split("");
    const letterPs = std.stagger(letters.length, t.in("enter"), { duration: 0.55 });
    const letterEls = letters
      .map((ch, i) => {
        const item = letterPs[i] ?? 0;
        const y = std.interpolate(item, [0, 1], [48, 0], "easeOutBack");
        const op = std.interpolate(item, [0, 1], [0, 1], "easeOutCubic");
        const x = width / 2 - (letters.length * 52) / 2 + i * 52;
        return `<text x="${x}" y="${height * 0.46 + y}" font-family="Inter,sans-serif" font-size="92" font-weight="800" fill="url(#titleGrad)" opacity="${op.toFixed(3)}">${ch}</text>`;
      })
      .join("");

    const subOp = std.interpolate(t.in("enter"), [0.4, 1], [0, 1], "easeOutCubic");
    const ringR = std.interpolate(timeline.progress, [0, 1], [180, 220], "easeInOutSine");
    const ringOp = 0.15 + 0.1 * Math.sin(timeline.progress * Math.PI * 4);

    const orbitDots: string[] = [];
    for (let i = 0; i < 8; i++) {
      const a = timeline.progress * Math.PI * 2 + (i / 8) * Math.PI * 2;
      const r = ringR + i * 6;
      const ox = width / 2 + Math.cos(a) * r;
      const oy = height * 0.46 + Math.sin(a) * r * 0.35;
      orbitDots.push(`<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="4" fill="${GOLD}" opacity="${(0.5 + i * 0.06).toFixed(2)}"/>`);
    }

    const fade = std.interpolate(t.in("exit"), [0, 1], [1, 0], "easeInCubic");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#12182a"/>
      <stop offset="100%" stop-color="${BG}"/>
    </radialGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="50%" stop-color="#eef2ff"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>
  <g opacity="${fade.toFixed(3)}">
    ${gridLines.join("\n")}
    <circle cx="${width / 2}" cy="${height * 0.46}" r="${ringR.toFixed(1)}" fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity="${ringOp.toFixed(3)}"/>
    ${orbitDots.join("\n")}
    <g filter="url(#glow)">${letterEls}</g>
    <text x="${width / 2}" y="${height * 0.56}" text-anchor="middle" font-family="Inter,sans-serif" font-size="28" font-weight="400" fill="#8b95b0" letter-spacing="8" opacity="${subOp.toFixed(3)}">${data.subtitle.toUpperCase()}</text>
  </g>
</svg>`;
  },
});