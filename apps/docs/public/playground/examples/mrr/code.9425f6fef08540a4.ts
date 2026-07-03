// MRR Counter
// Revenue milestone celebration

const TARGET_MRR = 50000;
const CURRENCY = "$";

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  // Dramatic easing
  const eased = 1 - Math.pow(1 - Math.min(1, timeline.progress * 1.1), 4);
  const amount = Math.floor(TARGET_MRR * eased);

  // Glow intensity based on progress
  const glowIntensity = 20 + timeline.progress * 40;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <div style="color: #10b981; font-size: 20px; letter-spacing: 4px; margin-bottom: 24px;">
        MONTHLY RECURRING REVENUE
      </div>
      <div style="
        color: #10b981;
        font-size: 120px;
        font-weight: bold;
        text-shadow: 0 0 ${glowIntensity}px rgba(16, 185, 129, 0.6);
      ">
        ${CURRENCY}${amount.toLocaleString()}
      </div>
      <div style="
        color: #6b7280;
        font-size: 24px;
        margin-top: 24px;
      ">
        🚀 We hit ${CURRENCY}${(TARGET_MRR / 1000)}K MRR!
      </div>
    </div>
  `;
  },
});