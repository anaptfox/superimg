import { define } from "superimg";

export default define({
  medium: "svg",
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "3s",
    fonts: ["Inter:wght@400;600;800", "JetBrains+Mono:wght@400"],
  },
  sample: {
    headline: "Rendered browser-free",
    detail: "resvg-wasm · composeSvg · zero Playwright",
  },
  render(ctx) {
    const { std, width, height, data, timeline } = ctx;
    const t = ctx.director({ enter: "60%", hold: "25%", exit: "15%" });
    const card = t.motion({ y: 40, scale: 0.92, easing: "easeOutBack" });

    const ringCount = 5;
    const rings: string[] = [];
    for (let i = 0; i < ringCount; i++) {
      const base = 100 + i * 55;
      const r = base + 20 * Math.sin(timeline.progress * Math.PI * 2 + i);
      const op = 0.08 + 0.06 * (ringCount - i) / ringCount;
      rings.push(
        `<circle cx="${width / 2}" cy="${height / 2}" r="${r.toFixed(1)}" fill="none" stroke="#5b8cff" stroke-width="1.5" opacity="${op.toFixed(3)}"/>`,
      );
    }

    const checkScale = std.interpolate(t.in("enter"), [0.3, 1], [0, 1], "easeOutBack");
    const badgeY = height / 2 - 30;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="outroBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06060f"/>
      <stop offset="50%" stop-color="#0c1020"/>
      <stop offset="100%" stop-color="#06060f"/>
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4fd1c5"/>
      <stop offset="100%" stop-color="#5b8cff"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#outroBg)"/>
  ${rings.join("\n")}
  <g transform="translate(${width / 2} ${height / 2})" opacity="${card.opacity.toFixed(3)}">
    <g transform="${card.transform}">
    <g transform="translate(0 ${badgeY - height / 2}) scale(${checkScale.toFixed(3)})">
      <circle cx="0" cy="0" r="52" fill="url(#badgeGrad)" opacity="0.9"/>
      <path d="M -18 2 L -4 18 L 24 -14" fill="none" stroke="#06060f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="0" y="30" text-anchor="middle" font-family="Inter,sans-serif" font-size="56" font-weight="800" fill="#f0f4ff">${data.headline}</text>
    <text x="0" y="85" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="22" fill="#8b95b0" letter-spacing="1">${data.detail}</text>
    <text x="0" y="140" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" fill="#5b8cff" letter-spacing="12" opacity="0.7">SUPERIMG</text>
    </g>
  </g>
</svg>`;
  },
});