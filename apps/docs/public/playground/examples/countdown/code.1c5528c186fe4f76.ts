// Countdown Timer — vertical launch clip with director-driven reveal
// Demonstrates: ctx.director(), std.spring(), std.css(), particle accents

import { define } from "superimg";

function generateParticles(std, time, count) {
  let particles = "";
  for (let i = 0; i < count; i++) {
    const x = 15 + (i * 70) % 70;
    const baseY = 100 - ((time * 20 + i * 15) % 120);
    const size = 4 + (i % 3) * 2;
    const opacity = std.interpolate((i % 5) / 5, [0, 1], [0.3, 0.7]);
    const hue = 30 + (i * 20) % 40;
    const particleColor = std.color.alpha(`hsl(${hue}, 100%, 70%)`, opacity);

    particles += `
      <div style="${std.css({
        position: "absolute",
        left: x + "%",
        top: baseY + "%",
        width: size,
        height: size,
        background: particleColor,
        borderRadius: "50%",
      })}"></div>
    `;
  }
  return particles;
}

export default define({
  config: {
    fps: 30,
    duration: "5s",
    width: 1080,
    height: 1920,
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .particles { position: absolute; inset: 0; pointer-events: none; }
      .container { text-align: center; position: relative; z-index: 1; }
      .label {
        font-size: 28px;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 8px;
      }
    `],
  },

  render(ctx) {
    const { std, timeline, width, height } = ctx;

    const t = ctx.director({ enter: "15%", hold: "70%", exit: "15%" });
    const intro = t.motion({ during: "enter", scale: 0.85, easing: "easeOutBack" });

    const remaining = Math.max(0, timeline.durationSeconds - timeline.seconds);
    const currentNumber = Math.ceil(remaining);
    const fraction = remaining % 1;

    const pulse = std.spring(1, 1.25, fraction, "snappy");
    const numberOpacity = std.interpolate(fraction, [0, 1], [0.55, 1]);
    const ringProgress = t.tween(0, 360, { during: "enter", for: "40%", easing: "easeOutCubic" });
    const bgHue = std.interpolate(t.progress, [0, 1], [18, 42]);

    const primaryColor = "#ff6b35";
    const secondaryColor = std.color.lighten(primaryColor, 30);
    const ringInnerBg = `hsl(${bgHue + 10}, 85%, 10%)`;
    const glowColor = std.color.alpha(primaryColor, 0.8);
    const ringSize = Math.min(width, height) * 0.42;
    const numSize = Math.min(width, height) * 0.18;
    const goSize = Math.min(width, height) * 0.14;

    const bodyStyle = std.css({
      width, height,
      background: `linear-gradient(180deg, hsl(${bgHue}, 80%, 14%) 0%, hsl(${bgHue + 20}, 90%, 6%) 100%)`,
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
      position: "relative",
    }, std.css.center());

    const ringStyle = std.css({
      width: ringSize, height: ringSize,
      borderRadius: "50%",
      background: `conic-gradient(from 0deg, ${primaryColor} 0deg, ${secondaryColor} ${ringProgress}deg, transparent ${ringProgress}deg)`,
      margin: "0 auto 48px",
    }, std.css.center(), intro.style);

    const ringInnerStyle = std.css({
      width: "85%", height: "85%",
      borderRadius: "50%",
      background: ringInnerBg,
    }, std.css.center());

    const numberStyle = std.css({
      fontSize: numSize, fontWeight: 800, color: "white",
      transform: "scale(" + pulse + ")",
      opacity: numberOpacity,
      textShadow: "0 0 60px " + glowColor,
    });

    const goStyle = std.css({
      fontSize: goSize, fontWeight: 800, color: primaryColor,
      textShadow: "0 0 80px " + primaryColor,
    });

    const labelMotion = t.motion({ during: "enter", at: "20%", y: 16 });

    return `
      <div style="${bodyStyle}">
        <div class="particles">
          ${generateParticles(std, timeline, 20)}
        </div>
        <div class="container">
          <div style="${ringStyle}">
            <div style="${ringInnerStyle}">
              ${currentNumber > 0
                ? `<div style="${numberStyle}">${currentNumber}</div>`
                : `<div style="${goStyle}">GO!</div>`
              }
            </div>
          </div>
          <div class="label" style="${labelMotion.style}">${currentNumber > 0 ? "Get Ready" : "Start!"}</div>
        </div>
      </div>
    `;
  },
});