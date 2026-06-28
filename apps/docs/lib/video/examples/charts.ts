export const STAR_HISTORY = `// Star History Chart — viz.charts.lineTime
// Sample data for facebook/react

const STARS = [
  { date: "2013-05-01", count: 100 },
  { date: "2015-01-01", count: 15000 },
  { date: "2017-01-01", count: 60000 },
  { date: "2020-01-01", count: 140000 },
  { date: "2024-01-01", count: 220000 },
];
const REPO = "facebook/react";

import { define } from "superimg";
export default define({
  medium: "svg",
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const progress = Math.min(1, timeline.progress * 2);
    const dates = STARS.map((s) => new Date(s.date).getTime());
    const maxStars = Math.max(...STARS.map((s) => s.count));

    const coords = viz.createCoords({
      width,
      height,
      xRange: [Math.min(...dates), Math.max(...dates)],
      yRange: [0, maxStars],
      padding: { top: 100, bottom: 60, left: 80, right: 80 },
    });

    const chartEl = viz.charts.lineTime(
      coords,
      STARS.map((s) => ({ date: s.date, value: s.count })),
      { animate: "draw", progress, colors: ["#f0c000"], fill: true },
    );

    const currentStars = Math.floor(STARS[STARS.length - 1].count * progress);

    return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">
  <rect width="\${width}" height="\${height}" fill="#0d1117"/>
  <text x="80" y="56" font-family="system-ui,sans-serif" font-size="24">⭐</text>
  <text x="120" y="56" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="#ffffff">\${REPO}</text>
  <text x="\${width - 80}" y="56" text-anchor="end" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#f0c000">\${currentStars.toLocaleString()} stars</text>
  \${chartEl}
</svg>\`;
  },
});`;

export const NPM_STATS = `// NPM Downloads — viz.charts.bar
// Sample data for lodash

const DOWNLOADS = [
  { label: "W1", value: 45 },
  { label: "W2", value: 48 },
  { label: "W3", value: 52 },
  { label: "W4", value: 47 },
  { label: "W5", value: 55 },
  { label: "W6", value: 58 },
];
const PACKAGE = "lodash";

import { define } from "superimg";
export default define({
  medium: "svg",
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const progress = Math.min(1, timeline.progress * 2);
    const maxVal = Math.max(...DOWNLOADS.map((d) => d.value));

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, DOWNLOADS.length + 1],
      yRange: [0, maxVal],
      padding: { top: 120, bottom: 80, left: 80, right: 80 },
    });

    const barsEl = viz.charts.bar(coords, DOWNLOADS, {
      animate: "grow",
      progress,
      colors: ["#cc3534"],
      showLabels: true,
      barRadius: 6,
    });

    const totalM = (DOWNLOADS.reduce((s, d) => s + d.value, 0) * progress / 10).toFixed(1);

    return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="\${width}" height="\${height}" fill="url(#bg)"/>
  <text x="80" y="72" font-family="system-ui,sans-serif" font-size="28">📦</text>
  <text x="130" y="72" font-family="system-ui,sans-serif" font-size="26" font-weight="600" fill="#ffffff">\${PACKAGE}</text>
  <text x="80" y="110" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#cc3534">\${totalM}M weekly downloads</text>
  \${barsEl}
</svg>\`;
  },
});`;

export const BENCHMARK = `// Benchmark Bars — viz.charts.barHorizontal
// Performance comparison chart

const BENCHMARKS = [
  { label: "Our Tool", value: 150 },
  { label: "Competitor A", value: 89 },
  { label: "Competitor B", value: 67 },
  { label: "Legacy", value: 23 },
];

import { define } from "superimg";
export default define({
  medium: "svg",
  config: { width: 1920, height: 1080, fps: 30, duration: 5 },
  render(ctx) {
    const { std, width, height, timeline } = ctx;
    const viz = std.viz;
    const progress = Math.min(1, timeline.progress * 2);
    const maxVal = Math.max(...BENCHMARKS.map((b) => b.value));

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, maxVal],
      yRange: [0, BENCHMARKS.length],
      padding: { top: 100, bottom: 60, left: 160, right: 100 },
    });

    const barsEl = viz.charts.barHorizontal(coords, BENCHMARKS, {
      animate: "grow",
      progress,
      colors: ["#10b981", "#6366f1", "#8b5cf6", "#64748b"],
      showLabels: true,
      showValueLabels: true,
      barRadius: 6,
    });

    return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">
  <rect width="\${width}" height="\${height}" fill="#0f172a"/>
  <text x="80" y="64" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="#ffffff">Performance Benchmark (ops/sec)</text>
  \${barsEl}
</svg>\`;
  },
});`;

export const TIMELINE = `// Animated Timeline
// Project roadmap with milestones

const EVENTS = [
  { label: "Q1", title: "MVP", icon: "🎯" },
  { label: "Q2", title: "Beta", icon: "🧪" },
  { label: "Q3", title: "v1.0", icon: "📦" },
  { label: "Q4", title: "Scale", icon: "📈" },
  { label: "Launch", title: "Public", icon: "🚀" },
];

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const padding = 60;
  const lineY = height / 2;
  const totalWidth = width - padding * 2;
  const spacing = totalWidth / (EVENTS.length - 1);

  // Animated line drawing progress
  const lineProgress = Math.min(1, timeline.progress * 1.5);
  const lineWidth = totalWidth * lineProgress;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      font-family: system-ui, sans-serif;
      position: relative;
    ">
      <h2 style="
        color: white;
        font-size: 32px;
        text-align: center;
        padding-top: 40px;
        margin: 0;
      ">Project Roadmap</h2>

      <!-- Timeline line -->
      <div style="
        position: absolute;
        top: \${lineY}px;
        left: \${padding}px;
        width: \${lineWidth}px;
        height: 4px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        border-radius: 2px;
      "></div>

      <!-- Events -->
      \${EVENTS.map((event, i) => {
        const x = padding + i * spacing;
        const eventProgress = Math.max(0, Math.min(1, (timeline.progress * 1.5 - i * 0.15) * 3));
        const opacity = eventProgress;
        const scale = 0.5 + eventProgress * 0.5;

        return \`
          <div style="
            position: absolute;
            left: \${x}px;
            top: \${lineY}px;
            transform: translate(-50%, -50%) scale(\${scale});
            opacity: \${opacity};
            text-align: center;
          ">
            <div style="
              width: 48px;
              height: 48px;
              background: linear-gradient(135deg, #3b82f6, #8b5cf6);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
            ">\${event.icon}</div>
            <div style="
              color: #94a3b8;
              font-size: 14px;
              margin-top: 16px;
            ">\${event.label}</div>
            <div style="
              color: white;
              font-size: 18px;
              font-weight: 600;
            ">\${event.title}</div>
          </div>
        \`;
      }).join('')}
    </div>
  \`;
  },
});`;