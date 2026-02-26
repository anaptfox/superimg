import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    label: "Conversion Rate",
    value: 94,
    unit: "%",
    target: 100,
    accentColor: "#10b981",
    secondaryColor: "#6ee7b7",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 4,
    fonts: ["JetBrains+Mono:wght@400;600", "Inter:wght@400;600"],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, isPortrait, data } = ctx;
    const { label, value, unit, target, accentColor, secondaryColor } = data;

    // Responsive sizing
    const valueSize = isPortrait ? 72 : 96;
    const labelSize = isPortrait ? 18 : 24;
    const barHeight = isPortrait ? 8 : 12;
    const barMaxWidth = isPortrait ? 280 : 400;

    // Phase timing: Enter 0-1.2s | Hold 1.2-3s | Exit 3-4s
    const enterProgress = std.math.clamp(time / 1.2, 0, 1);
    const exitProgress = std.math.clamp((time - 3.0) / 1.0, 0, 1);
    const easedEnter = std.easing.easeOutCubic(enterProgress);
    const bounceEnter = std.easing.easeOutBack(enterProgress);

    // Staggered elements
    const labelEnter = std.math.clamp((time - 0.1) / 0.8, 0, 1);
    const valueEnter = std.math.clamp((time - 0.3) / 1.0, 0, 1);
    const barEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);

    const easedLabel = std.easing.easeOutCubic(labelEnter);
    const easedValue = std.easing.easeOutBack(valueEnter);
    const easedBar = std.easing.easeOutCubic(barEnter);

    // Animated number (0 → value over hold phase)
    const countDuration = 1.5;
    const countStart = 1.2;
    const countProgress = std.math.clamp((time - countStart) / countDuration, 0, 1);
    const displayValue = Math.floor(std.math.lerp(0, value, std.easing.easeOutCubic(countProgress)));

    // Progress bar fill (0 → value/target, capped at 100%)
    const barFill = std.math.clamp(value / target, 0, 1) * easedBar * (1 - exitProgress);

    // Opacity with exit fade
    const opacity = easedEnter * (1 - exitProgress);
    const labelOpacity = easedLabel * (1 - exitProgress);
    const valueOpacity = easedValue * (1 - exitProgress);

    // Scale pop for value
    const valueScale = std.math.lerp(0.8, 1, bounceEnter) * (1 - exitProgress * 0.2);

    // Gradient for bar (accent → secondary)
    const barGradient = std.color.mix(accentColor, secondaryColor, 0.3);
    const barBg = std.color.alpha("#ffffff", 0.1);

    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${width}px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }
        .card {
          padding: ${isPortrait ? 32 : 48}px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
          opacity: ${opacity};
        }
        .label {
          font-size: ${labelSize}px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 12px;
          opacity: ${labelOpacity};
        }
        .value-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 20px;
        }
        .value {
          font-family: 'JetBrains Mono', monospace;
          font-size: ${valueSize}px;
          font-weight: 600;
          color: ${accentColor};
          transform: scale(${valueScale});
          opacity: ${valueOpacity};
        }
        .unit {
          font-family: 'JetBrains Mono', monospace;
          font-size: ${valueSize * 0.4}px;
          color: rgba(255, 255, 255, 0.5);
          opacity: ${valueOpacity};
        }
        .bar-track {
          width: ${barMaxWidth}px;
          height: ${barHeight}px;
          background: ${barBg};
          border-radius: ${barHeight / 2}px;
          overflow: hidden;
        }
        .bar-fill {
          width: ${barFill * 100}%;
          height: 100%;
          background: linear-gradient(90deg, ${accentColor}, ${barGradient});
          border-radius: ${barHeight / 2}px;
          transition: width 0.1s ease;
        }
      </style>
      <div class="card">
        <div class="label">${label}</div>
        <div class="value-row">
          <span class="value">${displayValue}</span>
          <span class="unit">${unit}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill"></div>
        </div>
      </div>
    `;
  },
});
