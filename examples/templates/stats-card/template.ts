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
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f172a; font-family: 'Inter', sans-serif; overflow: hidden; }
      .card {
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        text-align: left;
      }
      .label {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 12px;
      }
      .value-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 20px; }
      .value { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
      .unit { font-family: 'JetBrains Mono', monospace; color: rgba(255, 255, 255, 0.5); }
      .bar-track { overflow: hidden; }
      .bar-fill { height: 100%; transition: width 0.1s ease; }
    `],
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
    const easedEnter = std.tween(0, 1, enterProgress, "easeOutCubic");

    // Staggered elements
    const labelEnter = std.math.clamp((time - 0.1) / 0.8, 0, 1);
    const valueEnter = std.math.clamp((time - 0.3) / 1.0, 0, 1);
    const barEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);

    const easedLabel = std.tween(0, 1, labelEnter, "easeOutCubic");
    const easedValue = std.tween(0, 1, valueEnter, "easeOutBack");
    const easedBar = std.tween(0, 1, barEnter, "easeOutCubic");

    // Animated number (0 → value over hold phase)
    const countProgress = std.math.clamp((time - 1.2) / 1.5, 0, 1);
    const displayValue = Math.floor(std.tween(0, value, countProgress, "easeOutCubic"));

    // Progress bar fill (0 → value/target, capped at 100%)
    const barFill = std.math.clamp(value / target, 0, 1) * easedBar * (1 - exitProgress);

    const opacity = easedEnter * (1 - exitProgress);
    const labelOpacity = easedLabel * (1 - exitProgress);
    const valueOpacity = easedValue * (1 - exitProgress);
    const valueScale = std.tween(0.8, 1, enterProgress, "easeOutBack") * (1 - exitProgress * 0.2);

    const barGradient = std.color.mix(accentColor, secondaryColor, 0.3);
    const barBg = std.color.alpha("#ffffff", 0.1);

    const bodyStyle = std.css({ width, height }) + ";" + std.css.center();
    const cardStyle = std.css({ padding: isPortrait ? 32 : 48, opacity });
    const labelStyle = std.css({ fontSize: labelSize, opacity: labelOpacity });
    const valueStyle = std.css({
      fontSize: valueSize, color: accentColor,
      transform: "scale(" + valueScale + ")",
      opacity: valueOpacity,
    });
    const unitStyle = std.css({ fontSize: valueSize * 0.4, opacity: valueOpacity });
    const trackStyle = std.css({
      width: barMaxWidth, height: barHeight,
      background: barBg, borderRadius: barHeight / 2,
    });
    const fillStyle = std.css({
      width: barFill * 100 + "%",
      background: "linear-gradient(90deg, " + accentColor + ", " + barGradient + ")",
      borderRadius: barHeight / 2,
    });

    return `
      <div style="${bodyStyle}">
        <div class="card" style="${cardStyle}">
          <div class="label" style="${labelStyle}">${label}</div>
          <div class="value-row">
            <span class="value" style="${valueStyle}">${displayValue}</span>
            <span class="unit" style="${unitStyle}">${unit}</span>
          </div>
          <div class="bar-track" style="${trackStyle}">
            <div class="bar-fill" style="${fillStyle}"></div>
          </div>
        </div>
      </div>
    `;
  },
});
