// Star History Chart — viz.charts.lineTime
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

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0d1117"/>
  <text x="80" y="56" font-family="system-ui,sans-serif" font-size="24">⭐</text>
  <text x="120" y="56" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="#ffffff">${REPO}</text>
  <text x="${width - 80}" y="56" text-anchor="end" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#f0c000">${currentStars.toLocaleString()} stars</text>
  ${chartEl}
</svg>`;
  },
});