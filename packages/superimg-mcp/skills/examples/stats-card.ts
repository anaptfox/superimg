// Advanced template demonstrating phases, motion helpers, and responsive sizing
import { defineScene } from "superimg";

export default defineScene({
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
    duration: 4,
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
      .label { font-weight: 600; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
      .value-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 20px; }
      .value { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
      .unit { font-family: 'JetBrains Mono', monospace; color: rgba(255, 255, 255, 0.5); }
      .bar-track { overflow: hidden; }
      .bar-fill { height: 100%; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { label, value, unit, target, accentColor, secondaryColor } = data;

    // Responsive sizing - bind ctx once, use for all values
    const r = std.createResponsive(ctx);
    const valueSize = r({ portrait: 72, default: 96 });
    const labelSize = r({ portrait: 18, default: 24 });
    const barHeight = r({ portrait: 8, default: 12 });
    const barMaxWidth = r({ portrait: 280, default: 400 });
    const cardPadding = r({ portrait: 32, default: 48 });

    // Phase timing: 30% enter, 45% hold, 25% exit
    const { enter, hold, exit } = std.phases(sceneProgress, { enter: 3, hold: 4.5, exit: 2.5 });

    // Card enter/exit animation
    const card = std.motion.enterExit(sceneProgress, { y: 20, enterEnd: 0.3, exitStart: 0.75 });

    // Staggered element animations (within enter phase)
    const labelAnim = std.motion.enter(std.math.clamp(enter.progress * 1.2, 0, 1), { y: 10 });
    const valueAnim = std.motion.enter(std.math.clamp((enter.progress - 0.15) * 1.5, 0, 1), { y: 15, scale: 0.2, easing: "easeOutBack" });
    const barAnim = std.motion.enter(std.math.clamp((enter.progress - 0.3) * 1.5, 0, 1), { y: 10 });

    // Animated number (counts up during hold phase)
    const displayValue = Math.floor(std.tween(0, value, hold.progress, "easeOutCubic"));

    // Progress bar fill
    const barFill = std.math.clamp(value / target, 0, 1) * barAnim.opacity * (1 - exit.progress);

    // Colors
    const barGradient = std.color.mix(accentColor, secondaryColor, 0.3);
    const barBg = std.color.alpha("#ffffff", 0.1);

    // Styles
    const bodyStyle = std.css({ width, height }, std.css.center());
    const cardStyle = std.css({ padding: cardPadding, opacity: card.opacity });
    const labelStyle = std.css({ fontSize: labelSize, opacity: labelAnim.opacity });
    const valueStyle = std.css({ fontSize: valueSize, color: accentColor }, valueAnim.style);
    const unitStyle = std.css({ fontSize: valueSize * 0.4, opacity: valueAnim.opacity });
    const trackStyle = std.css({ width: barMaxWidth, height: barHeight, background: barBg, borderRadius: barHeight / 2 });
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
