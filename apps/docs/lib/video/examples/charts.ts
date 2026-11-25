// Runnable examples use typed chart artwork; layout also retains scales and data.
const chartExample = (horizontal: boolean, line: boolean) => `import { video, Frame, Stack, Text } from "@foxworth/superimg";
import { layout, defineChart, lineY, barY, barX, scaleLinear, scaleBand } from "@foxworth/superimg/charts";

const rows = ${line ? '[{ id: "2013", value: 100 }, { id: "2015", value: 15000 }, { id: "2017", value: 60000 }, { id: "2020", value: 140000 }, { id: "2024", value: 220000 }]' : horizontal ? '[{ id: "Our Tool", value: 150 }, { id: "Tool A", value: 89 }, { id: "Tool B", value: 67 }, { id: "Legacy", value: 23 }]' : '[{ id: "W1", value: 45 }, { id: "W2", value: 48 }, { id: "W3", value: 52 }, { id: "W4", value: 47 }, { id: "W5", value: 55 }, { id: "W6", value: 58 }]'};
export default video({
  duration: "5s",
  render(ctx) {
    const { width, height, timeline } = ctx;
    const chart = layout(defineChart({
      focus: false,
      marks: [${line ? 'lineY(rows, { id: "activity", key: "id", x: (d) => Number(d.id), y: "value", stroke: "#60a5fa", strokeWidth: 4 })' : horizontal ? 'barX(rows, { id: "activity", key: "id", y: "id", x: "value", fill: "#60a5fa" })' : 'barY(rows, { id: "activity", key: "id", x: "id", y: "value", fill: "#60a5fa" })'}],
      scales: {
        x: { scale: ${line ? 'scaleLinear().domain([2013, 2024])' : horizontal ? 'scaleLinear().domain([0, 170])' : 'scaleBand().domain(rows.map(d => d.id)).padding(.2)'} },
        y: { scale: ${horizontal ? 'scaleBand().domain(rows.map(d => d.id)).padding(.2)' : `scaleLinear().domain([0, ${line ? 240000 : horizontal ? 170 : 65}])`}, grid: ${!horizontal} },
      },
    }), {
      id: "weekly-activity", width: width - 160, height: height - 220,
      theme: { foreground: "#f8fafc", muted: "#94a3b8", grid: "#334155", background: "#0f172a", palette: ["#60a5fa"] },
      motion: { ${line ? 'lineReveal' : 'barsGrow'}: Math.min(1, timeline.seconds / 2) },
    });
    return Frame({ width, height, fill: "#0f172a" },
      Stack({ width: "fill", height: "fill", pad: 80, gap: 32 },
        Text({ size: 40, weight: 700, color: "#f8fafc" }, "${line ? "facebook/react · Star history" : horizontal ? "Performance · ops/sec" : "lodash · Weekly downloads (millions)"}"),
        chart.artwork));
  },
});`;

export const STAR_HISTORY = chartExample(false, true);
export const NPM_STATS = chartExample(false, false);
export const BENCHMARK = chartExample(true, false);

export const TIMELINE = `// Animated Timeline
// Project roadmap with milestones

const EVENTS = [
  { label: "Q1", title: "MVP", icon: "🎯" },
  { label: "Q2", title: "Beta", icon: "🧪" },
  { label: "Q3", title: "v1.0", icon: "📦" },
  { label: "Q4", title: "Scale", icon: "📈" },
  { label: "Launch", title: "Public", icon: "🚀" },
];

import { define, Html } from "@foxworth/superimg";
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

  return Html({ width: "fill", height: "fill", html: \`
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
  \` });
  },
});`;
