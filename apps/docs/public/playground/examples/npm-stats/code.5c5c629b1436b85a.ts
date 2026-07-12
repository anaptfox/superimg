import { define, type RenderContext } from "superimg";

export interface NpmStatsVideoData extends Record<string, unknown> {
  downloads: Array<{ date: string; count: number }>;
  package: string;
  description: string;
  totalDownloads: number;
  theme: "light" | "dark";
  showGrid: boolean;
  accentColor: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const NPM_LOGO =
  '<path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z"/>';

export default define<NpmStatsVideoData>({
  sample: {
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
    duration: "7s",
  },
  render(ctx: RenderContext<NpmStatsVideoData>) {
    const { std, width, height, data } = ctx;
    const { downloads, package: pkg, description, theme, showGrid, accentColor } = data;
    const viz = std.viz;

    const bgColor = theme === "dark" ? "#1a1a1a" : "#ffffff";
    const textColor = theme === "dark" ? "#e0e0e0" : "#333333";
    const mutedColor = theme === "dark" ? "#888888" : "#666666";
    const gridColor = theme === "dark" ? "#2a2a2a" : "#e5e5e5";

    const t = ctx.director({
      title: "0.56s",
      chart: "5.39s",
      pause: "0.49s",
      exit: "0.56s",
    });

    const titleProgress = t.in("title", { easing: "easeOutCubic" });
    const chartProgress = t.in("chart", { easing: "easeInOutCubic" });
    const globalOpacity = 1 - t.in("exit", { easing: "easeInCubic" });

    const padding = { top: 140, right: 80, bottom: 100, left: 100 };
    const dates = downloads.map((d) => new Date(d.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const maxDownloads = Math.max(...downloads.map((d) => d.count), 1);

    const coords = viz.createCoords({
      width,
      height,
      xRange: [minDate, maxDate],
      yRange: [0, maxDownloads],
      padding,
    });

    const gridEl = showGrid
      ? viz.grid(coords, { color: gridColor, ticks: 4, progress: chartProgress })
      : "";
    const axesEl = viz.axes(coords, {
      color: mutedColor,
      ticks: 4,
      progress: chartProgress,
      labels: false,
    });
    const chartEl = viz.charts.lineTime(
      coords,
      downloads.map((d) => ({ date: d.date, value: d.count })),
      {
        animate: "draw",
        progress: chartProgress,
        fill: true,
        colors: [accentColor],
      },
    );

    const visibleIdx = Math.max(0, Math.min(downloads.length - 1, Math.floor(chartProgress * downloads.length)));
    const currentDownloads = downloads[visibleIdx]?.count ?? 0;
    const currentDate = downloads[visibleIdx]?.date ?? downloads[0]?.date ?? "";
    const startDate = new Date(minDate);
    const endDate = new Date(maxDate);

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
              ${std.text.formatCompact(currentDownloads)}
            </span>
          </div>
          <div style="font-size: 16px; color: ${mutedColor}; margin-top: 4px;">
            weekly ${formatDate(currentDate)}
          </div>
        </div>
      </div>

      <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
        ${gridEl}
        ${axesEl}
        ${chartEl}
      </svg>

      <div style="position: absolute; bottom: 40px; left: ${padding.left}px; right: ${padding.right}px; display: flex; justify-content: space-between; color: ${mutedColor}; font-size: 16px;">
        <span>${formatDate(startDate.toISOString())}</span>
        <span>${formatDate(endDate.toISOString())}</span>
      </div>

      <div style="position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); color: ${mutedColor}; font-size: 14px; opacity: 0.6;">
        npm-stats · viz.charts.lineTime
      </div>
    </div>
  `;
  },
});