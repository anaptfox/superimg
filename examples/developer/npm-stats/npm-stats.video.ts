import { defineScene, type RenderContext } from "superimg";
import { formatCompact } from "superimg/stdlib/text";

export interface NpmStatsVideoData extends Record<string, unknown> {
  downloads: Array<{ date: string; count: number }>;
  package: string;
  description: string;
  totalDownloads: number;
  theme: "light" | "dark";
  showGrid: boolean;
  accentColor: string;
}

function formatNpmNumber(num: number): string {
  return formatCompact(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const NPM_LOGO =
  '<path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z"/>';

export default defineScene<NpmStatsVideoData>({
  data: {
    packageName: "react",
    downloads: [
      { date: "2024-01-01", count: 15000000 },
      { date: "2024-02-01", count: 16500000 },
      { date: "2024-03-01", count: 17200000 },
      { date: "2024-04-01", count: 18000000 },
      { date: "2024-05-01", count: 19500000 },
      { date: "2024-06-01", count: 20000000 },
    ],
    package: "react",
    description: "A JavaScript library for building user interfaces",
    totalDownloads: 106200000,
    theme: "dark",
    showGrid: true,
    accentColor: "#cb3837",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 7,
  },
  render(ctx: RenderContext<NpmStatsVideoData>) {
    const { std, width, height, data } = ctx;
    const { downloads, package: pkg, description, theme, showGrid, accentColor } = data;

    const bgColor = theme === "dark" ? "#1a1a1a" : "#ffffff";
    const textColor = theme === "dark" ? "#e0e0e0" : "#333333";
    const mutedColor = theme === "dark" ? "#888888" : "#666666";
    const gridColor = theme === "dark" ? "#2a2a2a" : "#e5e5e5";
    const areaOpacity = theme === "dark" ? "0.2" : "0.15";

    const t = std.score({
      title: 0.08,
      chart: 0.77,
      pause: 0.07,
      exit: 0.08
    });

    const titleProgress = t.within("title", { easing: "easeOutCubic" });
    const chartProgress = t.within("chart", { easing: "easeInOutCubic" });
    const globalOpacity = 1 - t.within("exit", { easing: "easeOutCubic" });

    const padding = { top: 140, right: 80, bottom: 100, left: 100 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxDownloads = Math.max(...downloads.map((d: { date: string; count: number }) => d.count), 1);
    const dates = downloads.map((d: { date: string; count: number }) => new Date(d.date).getTime());
    const minDate = Math.min(...dates, 0);
    const maxDate = Math.max(...dates, 1);
    const dateRange = maxDate - minDate || 1;

    const visiblePoints = Math.max(1, Math.floor(chartProgress * downloads.length));
    let pathD = "";
    let areaD = "";
    let lastX = padding.left;
    let lastY = padding.top + chartHeight;

    for (let i = 0; i < visiblePoints; i++) {
      const point = downloads[i];
      if (!point) continue;
      const x = padding.left + ((new Date(point.date).getTime() - minDate) / dateRange) * chartWidth;
      const y = padding.top + chartHeight - (point.count / maxDownloads) * chartHeight;

      if (i === 0) {
        pathD = `M ${x} ${y}`;
        areaD = `M ${x} ${padding.top + chartHeight} L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
      }
      lastX = x;
      lastY = y;
    }

    if (visiblePoints > 0) {
      areaD += ` L ${lastX} ${padding.top + chartHeight} Z`;
    }

    const currentDownloads = visiblePoints > 0 ? downloads[visiblePoints - 1]?.count ?? 0 : 0;
    const currentDate = visiblePoints > 0 ? downloads[visiblePoints - 1]?.date ?? "" : downloads[0]?.date ?? "";

    const gridLines: Array<{ y: number; value: number }> = [];
    if (showGrid) {
      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const y = padding.top + (chartHeight / gridSteps) * i;
        const value = Math.round(maxDownloads * (1 - i / gridSteps));
        gridLines.push({ y, value });
      }
    }

    const startDate = new Date(minDate);
    const endDate = new Date(maxDate);

    const gridLinesHtml = gridLines
      .map(
        (line) => `
          <line x1="${padding.left}" y1="${line.y}" x2="${width - padding.right}" y2="${line.y}"
                stroke="${gridColor}" stroke-width="1" opacity="0.6"/>
          <text x="${padding.left - 12}" y="${line.y + 5}"
                fill="${mutedColor}" font-size="14" text-anchor="end">
            ${formatNpmNumber(line.value)}
          </text>
        `
      )
      .join("");

    const areaOpacityNum = parseFloat(areaOpacity);

    return `
    <div style="width: ${width}px; height: ${height}px; background: ${bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; position: relative; opacity: ${globalOpacity};">

      <div style="position: absolute; top: 40px; left: ${padding.left}px; right: ${padding.right}px; display: flex; justify-content: space-between; align-items: flex-start; opacity: ${titleProgress}; transform: translateY(${(1 - titleProgress) * -15}px);">
        <div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: ${accentColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                ${NPM_LOGO}
              </svg>
            </div>
            <span style="font-size: 32px; font-weight: 600; color: ${textColor};">${pkg}</span>
          </div>
          ${description ? `<div style="font-size: 18px; color: ${mutedColor}; margin-top: 8px; max-width: 600px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${description}</div>` : ""}
        </div>

        <div style="text-align: right;">
          <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="${accentColor}">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span style="font-size: 48px; font-weight: 700; color: ${accentColor};">
              ${formatNpmNumber(currentDownloads)}
            </span>
          </div>
          <div style="font-size: 16px; color: ${mutedColor}; margin-top: 4px;">
            weekly ${formatDate(currentDate)}
          </div>
        </div>
      </div>

      <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
        ${gridLinesHtml}

        <defs>
          <linearGradient id="npmAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${accentColor};stop-opacity:${areaOpacityNum * 2}" />
            <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0" />
          </linearGradient>
        </defs>

        <path d="${areaD}" fill="url(#npmAreaGradient)"/>
        <path d="${pathD}" fill="none" stroke="${accentColor}" stroke-width="4"
              stroke-linecap="round" stroke-linejoin="round"/>

        ${visiblePoints > 0 ? `
          <circle cx="${lastX}" cy="${lastY}" r="12" fill="${accentColor}" opacity="0.3"/>
          <circle cx="${lastX}" cy="${lastY}" r="8" fill="${accentColor}"/>
          <circle cx="${lastX}" cy="${lastY}" r="4" fill="${bgColor}"/>
        ` : ""}
      </svg>

      <div style="position: absolute; bottom: 40px; left: ${padding.left}px; right: ${padding.right}px; display: flex; justify-content: space-between; color: ${mutedColor}; font-size: 16px;">
        <span>${formatDate(startDate.toISOString())}</span>
        <span>${formatDate(endDate.toISOString())}</span>
      </div>

      <div style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); color: ${mutedColor}; font-size: 14px; opacity: 0.6;">
        npm-stats
      </div>
    </div>
  `;
  },
});
