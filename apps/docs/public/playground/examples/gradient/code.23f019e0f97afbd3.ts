// Gradient Background
// Smoothly shifting gradient animation

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const hue1 = (timeline.progress * 360) % 360;
  const hue2 = (hue1 + 60) % 360;
  const angle = timeline.progress * 360;

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: linear-gradient(
        ${angle}deg,
        hsl(${hue1}, 80%, 60%),
        hsl(${hue2}, 70%, 50%)
      );
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        font-family: system-ui, sans-serif;
        font-size: 32px;
        color: white;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        opacity: 0.9;
      ">
        Progress: ${Math.round(timeline.progress * 100)}%
      </div>
    </div>
  `;
  },
});