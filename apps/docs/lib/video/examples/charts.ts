export const STAR_HISTORY = `// Star History Chart
// Sample data for facebook/react

const STARS = [
  { date: "2013-05", count: 100 },
  { date: "2015-01", count: 15000 },
  { date: "2017-01", count: 60000 },
  { date: "2020-01", count: 140000 },
  { date: "2024-01", count: 220000 },
];
const REPO = "facebook/react";

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2 - 60;
  const maxStars = Math.max(...STARS.map(s => s.count));

  // Animate the line drawing
  const animatedPoints = STARS.map((star, i) => {
    const x = padding + (i / (STARS.length - 1)) * chartWidth;
    const targetY = padding + 60 + chartHeight - (star.count / maxStars) * chartHeight;
    const y = padding + 60 + chartHeight - ((star.count / maxStars) * chartHeight * Math.min(1, sceneProgress * 2));
    return { x, y, date: star.date, count: star.count };
  });

  const pathD = animatedPoints.map((p, i) =>
    \`\${i === 0 ? 'M' : 'L'} \${p.x} \${p.y}\`
  ).join(' ');

  const currentStars = Math.floor(STARS[STARS.length - 1].count * Math.min(1, sceneProgress * 2));

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #0d1117;
      font-family: system-ui, sans-serif;
      position: relative;
    ">
      <div style="
        padding: 20px \${padding}px;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <span style="font-size: 24px;">⭐</span>
        <span style="color: white; font-size: 20px; font-weight: 600;">\${REPO}</span>
        <span style="color: #f0c000; font-size: 20px; font-weight: bold; margin-left: auto;">
          \${currentStars.toLocaleString()} stars
        </span>
      </div>
      <svg width="\${width}" height="\${chartHeight + 40}" style="position: absolute; top: 60px;">
        <path d="\${pathD}" fill="none" stroke="#f0c000" stroke-width="3"/>
        \${animatedPoints.map(p => \`
          <circle cx="\${p.x}" cy="\${p.y}" r="6" fill="#f0c000"/>
        \`).join('')}
      </svg>
    </div>
  \`;
}`;

export const NPM_STATS = `// NPM Downloads
// Sample data for lodash

const DOWNLOADS = [
  { week: "Week 1", count: 45000000 },
  { week: "Week 2", count: 48000000 },
  { week: "Week 3", count: 52000000 },
  { week: "Week 4", count: 47000000 },
  { week: "Week 5", count: 55000000 },
  { week: "Week 6", count: 58000000 },
];
const PACKAGE = "lodash";

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const padding = 40;
  const barWidth = (width - padding * 2) / DOWNLOADS.length - 10;
  const maxDownloads = Math.max(...DOWNLOADS.map(d => d.count));
  const chartHeight = height - 140;

  const totalDownloads = Math.floor(
    DOWNLOADS.reduce((sum, d) => sum + d.count, 0) * Math.min(1, sceneProgress * 1.5)
  );

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      font-family: system-ui, sans-serif;
      padding: \${padding}px;
      box-sizing: border-box;
    ">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <span style="font-size: 28px;">📦</span>
        <span style="color: white; font-size: 24px; font-weight: 600;">\${PACKAGE}</span>
      </div>
      <div style="color: #cc3534; font-size: 36px; font-weight: bold; margin-bottom: 30px;">
        \${(totalDownloads / 1000000).toFixed(1)}M weekly downloads
      </div>
      <div style="display: flex; align-items: flex-end; gap: 10px; height: \${chartHeight}px;">
        \${DOWNLOADS.map((d, i) => {
          const barHeight = (d.count / maxDownloads) * chartHeight * Math.min(1, sceneProgress * 2 - i * 0.1);
          return \`
            <div style="
              width: \${barWidth}px;
              height: \${Math.max(0, barHeight)}px;
              background: linear-gradient(180deg, #cc3534 0%, #e74c3c 100%);
              border-radius: 4px 4px 0 0;
            "></div>
          \`;
        }).join('')}
      </div>
    </div>
  \`;
}`;

export const BENCHMARK = `// Benchmark Bars
// Performance comparison chart

const BENCHMARKS = [
  { name: "Our Tool", value: 150, color: "#10b981" },
  { name: "Competitor A", value: 89, color: "#6366f1" },
  { name: "Competitor B", value: 67, color: "#8b5cf6" },
  { name: "Legacy", value: 23, color: "#64748b" },
];

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const maxValue = Math.max(...BENCHMARKS.map(b => b.value));
  const barHeight = 50;
  const gap = 24;

  return \`
    <div style="
      width: \${width}px;
      height: \${height}px;
      background: #0f172a;
      font-family: system-ui, sans-serif;
      padding: 40px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
    ">
      <h2 style="color: white; font-size: 28px; margin-bottom: 40px;">
        Performance Benchmark (ops/sec)
      </h2>
      \${BENCHMARKS.map((b, i) => {
        const animatedWidth = (b.value / maxValue) * (width - 200) * Math.min(1, sceneProgress * 2 - i * 0.15);
        return \`
          <div style="margin-bottom: \${gap}px;">
            <div style="color: #94a3b8; font-size: 16px; margin-bottom: 8px;">
              \${b.name}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="
                width: \${Math.max(0, animatedWidth)}px;
                height: \${barHeight}px;
                background: \${b.color};
                border-radius: 4px;
                transition: width 0.3s;
              "></div>
              <span style="color: white; font-size: 20px; font-weight: bold;">
                \${Math.floor(b.value * Math.min(1, sceneProgress * 2 - i * 0.15))}
              </span>
            </div>
          </div>
        \`;
      }).join('')}
    </div>
  \`;
}`;

export const TIMELINE = `// Animated Timeline
// Project roadmap with milestones

const EVENTS = [
  { label: "Q1", title: "MVP", icon: "🎯" },
  { label: "Q2", title: "Beta", icon: "🧪" },
  { label: "Q3", title: "v1.0", icon: "📦" },
  { label: "Q4", title: "Scale", icon: "📈" },
  { label: "Launch", title: "Public", icon: "🚀" },
];

export function render(ctx) {
  const { width, height, sceneProgress } = ctx;

  const padding = 60;
  const lineY = height / 2;
  const totalWidth = width - padding * 2;
  const spacing = totalWidth / (EVENTS.length - 1);

  // Animated line drawing progress
  const lineProgress = Math.min(1, sceneProgress * 1.5);
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
        const eventProgress = Math.max(0, Math.min(1, (sceneProgress * 1.5 - i * 0.15) * 3));
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
}`;
