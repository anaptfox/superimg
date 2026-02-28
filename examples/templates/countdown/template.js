// Countdown Timer Example
// Animated countdown with pulsing numbers and particle effects
// Demonstrates: std.css(), std.css.center(), inlineCss, easing, math, and color utilities

import { defineTemplate } from "superimg";

function generateParticles(std, time, count) {
  let particles = "";
  for (let i = 0; i < count; i++) {
    const x = 15 + (i * 70) % 70;
    const baseY = 100 - ((time * 20 + i * 15) % 120);
    const size = 4 + (i % 3) * 2;
    const opacity = std.tween(0.3, 0.7, (i % 5) / 5);
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

export default defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 5,
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
    const { std, sceneTimeSeconds, sceneProgress, sceneDurationSeconds, width, height } = ctx;

    const remaining = Math.max(0, sceneDurationSeconds - sceneTimeSeconds);
    const currentNumber = Math.ceil(remaining);
    const fraction = remaining % 1;

    const pulse = std.tween(1, 1.3, fraction, "easeOutBack");
    const numberOpacity = std.tween(0.5, 1, fraction);
    const ringProgress = std.tween(0, 360, sceneProgress, "easeInOutCubic");
    const bgHue = std.tween(20, 50, sceneProgress);

    const primaryColor = "#ff6b35";
    const secondaryColor = std.color.lighten(primaryColor, 30);
    const ringInnerBg = `hsl(${bgHue + 10}, 85%, 10%)`;
    const glowColor = std.color.alpha(primaryColor, 0.8);
    const ringSize = Math.min(width, height) * 0.5;
    const numSize = Math.min(width, height) * 0.25;
    const goSize = Math.min(width, height) * 0.2;

    const bodyStyle = std.css({
      width, height,
      background: `linear-gradient(180deg, hsl(${bgHue}, 80%, 15%) 0%, hsl(${bgHue + 20}, 90%, 8%) 100%)`,
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
      position: "relative",
    }) + ";" + std.css.center();

    const ringStyle = std.css({
      width: ringSize, height: ringSize,
      borderRadius: "50%",
      background: `conic-gradient(from 0deg, ${primaryColor} 0deg, ${secondaryColor} ${ringProgress}deg, transparent ${ringProgress}deg)`,
      margin: "0 auto 60px",
    }) + ";" + std.css.center();

    const ringInnerStyle = std.css({
      width: "85%", height: "85%",
      borderRadius: "50%",
      background: ringInnerBg,
    }) + ";" + std.css.center();

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

    return `
      <div style="${bodyStyle}">
        <div class="particles">
          ${generateParticles(std, sceneTimeSeconds, 20)}
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
          <div class="label">${currentNumber > 0 ? "Get Ready" : "Start!"}</div>
        </div>
      </div>
    `;
  },
});
