import { defineScene } from "superimg";

export default defineScene({
  config: {
    fps: 30,
    duration: 12,
    width: 1920,
    height: 1080,
  },
  defaults: {
    title: "Project Activity",
    accentColor: "#38bdf8",
    months: [] as string[],
    series: [] as Array<{ name: string; values: number[] }>,
  },
  render({ sceneTimeSeconds: t, data, std, width, height }) {
    const { title, months, series, accentColor } = data;
    if (!series.length || !months.length) {
      return `<div style="${std.css({ width, height, background: "#090a10" })};${std.css.center()}">
        <div style="color:rgba(255,255,255,0.35); font:600 28px system-ui;">Not enough git history</div>
      </div>`;
    }

    const chartLeft = 180;
    const chartTop = 250;
    const chartW = width - 330;
    const chartH = height - 420;
    const points = months.length;
    const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
    const drawP = std.math.clamp((t - 1.2) / 8.8, 0, 1);
    const exitP = std.math.clamp((t - 10.5) / 1.5, 0, 1);
    const colors = [accentColor, "#40d9a8", "#ffa452", "#9d86ff"];

    const monthLabels = months
      .map((m, i) => {
        const x = chartLeft + (i / Math.max(points - 1, 1)) * chartW;
        return `<div style="position:absolute; left:${x - 35}px; top:${chartTop + chartH + 26}px; width:70px; text-align:center; color:rgba(255,255,255,0.42); font-size:16px;">${m}</div>`;
      })
      .join("");

    const lines = series
      .map((s, idx) => {
        const lineColor = colors[idx % colors.length];
        const visibleCount = Math.max(2, Math.ceil(points * drawP));
        const path = s.values
          .slice(0, visibleCount)
          .map((v, i) => {
            const x = chartLeft + (i / Math.max(points - 1, 1)) * chartW;
            const y = chartTop + chartH - (v / maxValue) * chartH;
            return `${x},${y}`;
          })
          .join(" ");

        const latest = s.values[Math.max(0, visibleCount - 1)] ?? 0;
        const lx = chartLeft + ((visibleCount - 1) / Math.max(points - 1, 1)) * chartW;
        const ly = chartTop + chartH - (latest / maxValue) * chartH;
        return `
          <polyline points="${path}" fill="none" stroke="${lineColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="${lx}" cy="${ly}" r="7" fill="${lineColor}" />
          <text x="${lx + 10}" y="${ly - 10}" fill="${lineColor}" font-size="18" font-family="system-ui" font-weight="700">${s.name}</text>
        `;
      })
      .join("");

    return `
      <div style="${std.css({
        width,
        height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        background: "linear-gradient(165deg, #0F172A 0%, #1E293B 50%, #020617 100%)",
      })}">
        <div style="position:absolute; top:90px; left:180px; color:white; font-size:58px; font-weight:800;">Activity Race</div>
        <div style="position:absolute; top:160px; left:180px; color:rgba(255,255,255,0.62); font-size:26px;">${title}</div>
        <svg width="${width}" height="${height}" style="position:absolute; left:0; top:0;">
          <line x1="${chartLeft}" y1="${chartTop + chartH}" x2="${chartLeft + chartW}" y2="${chartTop + chartH}" stroke="rgba(255,255,255,0.14)" stroke-width="2" />
          <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartTop + chartH}" stroke="rgba(255,255,255,0.14)" stroke-width="2" />
          ${lines}
        </svg>
        ${monthLabels}
        <div style="position:absolute; inset:0; background:black; opacity:${exitP};"></div>
      </div>
    `;
  },
});
