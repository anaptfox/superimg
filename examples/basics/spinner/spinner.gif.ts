import { defineGif } from "superimg";

export default defineGif({
  config: {
    width: 200,
    height: 200,
    fps: 24,
    duration: 1.5,
    gif: { loop: 0, maxColors: 64 },
  },
  render(ctx) {
    const { width, height, globalTimeSeconds } = ctx;
    const t = globalTimeSeconds / 1.5;
    const angle = t * 360;
    const cx = width / 2;
    const cy = height / 2;
    const r = 70;
    const arcX = cx + r * Math.cos((angle - 90) * Math.PI / 180);
    const arcY = cy + r * Math.sin((angle - 90) * Math.PI / 180);
    const largeArc = t > 0.5 ? 1 : 0;

    return `<div style="width:${width}px;height:${height}px;background:#0f172a;display:flex;align-items:center;justify-content:center;">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e293b" stroke-width="10"/>
        <path d="M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${arcX.toFixed(2)} ${arcY.toFixed(2)}"
          fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round"/>
      </svg>
    </div>`;
  },
});
