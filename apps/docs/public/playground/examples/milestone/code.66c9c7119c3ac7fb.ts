// Follower Milestone
// Dramatic counter reveal

const MILESTONE = 100000;
const PLATFORM = "Twitter";

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Easing function for dramatic effect
  const eased = 1 - Math.pow(1 - Math.min(1, timeline.progress * 1.2), 3);
  const count = Math.floor(MILESTONE * eased);

  // Particle effect
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: width / 2 + Math.sin(i * 0.5 + timeline.progress * 10) * (100 + i * 10) * timeline,     y: height / 2 + Math.cos(i * 0.7 + timeline.progress * 8) * (80 + i * 8) * timeline,     size: 4 + Math.random() * 4,
    opacity: Math.max(0, 1 - timeline.progress * 1.5 + 0.5),
  }));

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: radial-gradient(circle at center, #1d4ed8 0%, #0f172a 70%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    ">
      ${particles.map(p => `
        <div style="
          position: absolute;
          left: ${p.x}px;
          top: ${p.y}px;
          width: ${p.size}px;
          height: ${p.size}px;
          background: #60a5fa;
          border-radius: 50%;
          opacity: ${p.opacity};
        "></div>
      `).join('')}
      <div style="color: #60a5fa; font-size: 24px; margin-bottom: 16px;">
        🎉 ${PLATFORM} Milestone
      </div>
      <div style="
        color: white;
        font-size: 96px;
        font-weight: bold;
        text-shadow: 0 0 40px rgba(96, 165, 250, 0.5);
      ">
        ${count.toLocaleString()}
      </div>
      <div style="color: #94a3b8; font-size: 28px; margin-top: 8px;">
        followers
      </div>
    </div>
  `;
  },
});