// Countdown Timer Example
// Animated countdown with pulsing numbers and particle effects
// Demonstrates: easing, math, and color utilities from ctx.std

import { defineTemplate } from "superimg";

function generateParticles(std, time, count) {
  let particles = "";
  for (let i = 0; i < count; i++) {
    const x = 15 + (i * 70) % 70;
    const baseY = 100 - ((time * 20 + i * 15) % 120);
    const size = 4 + (i % 3) * 2;
    const opacity = std.math.lerp(0.3, 0.7, (i % 5) / 5);
    const hue = 30 + (i * 20) % 40;
    const particleColor = std.color.alpha(`hsl(${hue}, 100%, 70%)`, opacity);

    particles += `
      <div style="
        position: absolute;
        left: ${x}%;
        top: ${baseY}%;
        width: ${size}px;
        height: ${size}px;
        background: ${particleColor};
        border-radius: 50%;
      "></div>
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
  },

  render(ctx) {
    const { std, sceneTimeSeconds, sceneProgress, sceneDurationSeconds, width, height } = ctx;

    // Countdown number (5 to 0)
    const remaining = Math.max(0, sceneDurationSeconds - sceneTimeSeconds);
    const currentNumber = Math.ceil(remaining);
    const fraction = remaining % 1;

    // Pulse effect when number changes
    const pulseT = std.easing.easeOutBack(fraction);
    const pulse = std.math.lerp(1, 1.3, pulseT);
    const numberOpacity = std.math.lerp(0.5, 1, fraction);

    // Ring sweeps as time passes
    const easedProgress = std.easing.easeInOutCubic(sceneProgress);
    const ringProgress = easedProgress * 360;

    // Background gradient shifts warm → orange
    const bgHue = std.math.lerp(20, 50, sceneProgress);

    const primaryColor = "#ff6b35";
    const secondaryColor = std.color.lighten(primaryColor, 30);
    const ringInnerBg = `hsl(${bgHue + 10}, 85%, 10%)`;
    const glowColor = std.color.alpha(primaryColor, 0.8);

    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${width}px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg,
            hsl(${bgHue}, 80%, 15%) 0%,
            hsl(${bgHue + 20}, 90%, 8%) 100%
          );
          font-family: system-ui, sans-serif;
          overflow: hidden;
          position: relative;
        }
        .particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .container {
          text-align: center;
          position: relative;
          z-index: 1;
        }
        .ring {
          width: ${Math.min(width, height) * 0.5}px;
          height: ${Math.min(width, height) * 0.5}px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            ${primaryColor} 0deg,
            ${secondaryColor} ${ringProgress}deg,
            transparent ${ringProgress}deg
          );
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 60px;
        }
        .ring-inner {
          width: 85%;
          height: 85%;
          border-radius: 50%;
          background: ${ringInnerBg};
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .number {
          font-size: ${Math.min(width, height) * 0.25}px;
          font-weight: 800;
          color: white;
          transform: scale(${pulse});
          opacity: ${numberOpacity};
          text-shadow: 0 0 60px ${glowColor};
        }
        .label {
          font-size: 28px;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 8px;
        }
        .go {
          font-size: ${Math.min(width, height) * 0.2}px;
          font-weight: 800;
          color: ${primaryColor};
          text-shadow: 0 0 80px ${primaryColor};
        }
      </style>
      <div class="particles">
        ${generateParticles(std, sceneTimeSeconds, 20)}
      </div>
      <div class="container">
        <div class="ring">
          <div class="ring-inner">
            ${currentNumber > 0
              ? `<div class="number">${currentNumber}</div>`
              : `<div class="go">GO!</div>`
            }
          </div>
        </div>
        <div class="label">${currentNumber > 0 ? "Get Ready" : "Start!"}</div>
      </div>
    `;
  },
});
