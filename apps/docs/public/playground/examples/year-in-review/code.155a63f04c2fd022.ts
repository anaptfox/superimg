// Year in Review / Wrapped
// Spotify Wrapped-style stats reveal

const STATS = [
  { label: "Lines of Code", value: "127,493", icon: "💻" },
  { label: "Commits", value: "1,247", icon: "📝" },
  { label: "Pull Requests", value: "389", icon: "🔀" },
  { label: "Issues Closed", value: "156", icon: "✅" },
];

const YEAR = "2025";

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Gradient rotation
  const gradientAngle = timeline.progress * 45;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(${135 + gradientAngle}deg, #1a1a2e 0%, #2d1b4e 50%, #1e3a5f 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      <!-- Year Badge -->
      <div style="
        font-size: 72px;
        font-weight: 800;
        background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 40px;
        opacity: ${Math.min(1, timeline.progress * 3)};
        transform: scale(${0.8 + Math.min(0.2, timeline.progress * 0.4)});
      ">${YEAR} Wrapped</div>

      <!-- Stats Grid -->
      <div style="
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      ">
        ${STATS.map((stat, i) => {
          const delay = i * 0.15;
          const opacity = Math.min(1, Math.max(0, (timeline.progress - delay - 0.2) * 3));
          const translateY = (1 - opacity) * 30;
          return `
            <div style="
              background: rgba(255,255,255,0.1);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 24px 32px;
              text-align: center;
              opacity: ${opacity};
              transform: translateY(${translateY}px);
            ">
              <div style="font-size: 36px; margin-bottom: 8px;">${stat.icon}</div>
              <div style="
                font-size: 36px;
                font-weight: 700;
                color: white;
                margin-bottom: 4px;
              ">${stat.value}</div>
              <div style="
                font-size: 14px;
                color: rgba(255,255,255,0.7);
                text-transform: uppercase;
                letter-spacing: 1px;
              ">${stat.label}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Decorative circles -->
      <div style="
        position: absolute;
        width: 300px;
        height: 300px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,107,107,0.3) 0%, transparent 70%);
        top: -100px;
        right: -100px;
        opacity: ${ timeline };
      "></div>
      <div style="
        position: absolute;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(72,219,251,0.3) 0%, transparent 70%);
        bottom: -50px;
        left: -50px;
        opacity: ${ timeline };
      "></div>
    </div>
  `;
  },
});