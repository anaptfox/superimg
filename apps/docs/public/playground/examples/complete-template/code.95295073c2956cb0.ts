// Complete Template
// Demonstrates config (width, fps, duration) and data together

import { define } from "superimg";

export default define({
  config: {
    width: 1280,
    height: 720,
    fps: 30,
    duration: 4,
  },
  sample: {
    title: "Welcome",
    subtitle: "Customize via data",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { std, timeline, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const enterProgress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.interpolate(enterProgress, [0, 1], [0, 1], "easeOutCubic");
    const y = std.interpolate(enterProgress, [0, 1], [30, 0], "easeOutCubic");

    return `
      <div style="
        width: ${width}px;
        height: ${height}px;
        background: linear-gradient(135deg, #0f0f23, #1a1a2e);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="
          font-size: 64px;
          color: ${accentColor};
          opacity: ${opacity};
          transform: translateY(${y}px);
          margin: 0;
        ">${title}</h1>
        <p style="
          font-size: 24px;
          color: white;
          opacity: ${opacity * 0.8};
          transform: translateY(${y}px);
          margin-top: 16px;
        ">${subtitle}</p>
      </div>
    `;
  },
});