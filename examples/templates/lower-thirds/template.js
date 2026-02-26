// Lower Thirds Example — Broadcast-style speaker identification
// Demonstrates: staggered slide animation, easeOutCubic/easeInCubic, color.alpha(), lerp()
// Customize by passing data or editing the defaults!

import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    name: "Jane Doe",
    title: "Senior Engineer, Acme Corp",
    accentColor: "#3b82f6",
  },

  config: {
    fps: 30,
    durationSeconds: 4,
    fonts: ["Inter:wght@400;600;700"],
    outputs: {
      youtube: { width: 1920, height: 1080 },
    },
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, isPortrait, data } = ctx;
    const { name, title, accentColor } = data;

    // Responsive sizing
    const nameSize = isPortrait ? 28 : 42;
    const titleSize = isPortrait ? 18 : 24;
    const barWidth = isPortrait ? 3 : 4;
    const namePadV = isPortrait ? 10 : 14;
    const namePadH = isPortrait ? 16 : 24;
    const titlePadV = isPortrait ? 8 : 10;
    const titlePadH = isPortrait ? 16 : 24;
    const bottomOffset = isPortrait ? 40 : 80;

    const offScreenX = -(width * 0.45);

    // Enter phase (staggered slide-in from left)
    // Bar: 0.0s, Name: +0.15s, Title: +0.35s
    const barEnter   = std.easing.easeOutCubic(std.math.clamp(time / 0.6, 0, 1));
    const nameEnter  = std.easing.easeOutCubic(std.math.clamp((time - 0.15) / 0.7, 0, 1));
    const titleEnter = std.easing.easeOutCubic(std.math.clamp((time - 0.35) / 0.7, 0, 1));

    // Exit phase (staggered slide-out, reverse order)
    // Title: 2.8s, Name: +0.15s, Bar: +0.35s
    const titleExit = std.easing.easeInCubic(std.math.clamp((time - 2.8)  / 0.5, 0, 1));
    const nameExit  = std.easing.easeInCubic(std.math.clamp((time - 2.95) / 0.5, 0, 1));
    const barExit   = std.easing.easeInCubic(std.math.clamp((time - 3.15) / 0.5, 0, 1));

    const barX   = std.math.lerp(offScreenX, 0, barEnter)   + std.math.lerp(0, offScreenX, barExit);
    const nameX  = std.math.lerp(offScreenX, 0, nameEnter)  + std.math.lerp(0, offScreenX, nameExit);
    const titleX = std.math.lerp(offScreenX, 0, titleEnter) + std.math.lerp(0, offScreenX, titleExit);

    const titleOpacity = titleEnter * (1 - titleExit);

    const nameBg  = std.color.alpha("#000000", 0.85);
    const titleBg = std.color.alpha("#000000", 0.65);
    const barGlow = std.color.alpha(accentColor, 0.4);

    return `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${width}px;
          height: ${height}px;
          background: transparent;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
          position: relative;
        }
        .lower-third {
          position: absolute;
          bottom: ${bottomOffset}px;
          left: 0;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }
        .accent-bar {
          width: ${barWidth}px;
          background: ${accentColor};
          box-shadow: 0 0 12px ${barGlow}, 0 0 4px ${barGlow};
          transform: translateX(${barX}px);
          flex-shrink: 0;
        }
        .text-block {
          display: flex;
          flex-direction: column;
        }
        .name-strip {
          background: ${nameBg};
          padding: ${namePadV}px ${namePadH}px;
          transform: translateX(${nameX}px);
        }
        .name-text {
          font-size: ${nameSize}px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          letter-spacing: 0.5px;
        }
        .title-strip {
          background: ${titleBg};
          padding: ${titlePadV}px ${titlePadH}px;
          transform: translateX(${titleX}px);
          opacity: ${titleOpacity};
        }
        .title-text {
          font-size: ${titleSize}px;
          font-weight: 400;
          color: ${std.color.alpha("#ffffff", 0.9)};
          white-space: nowrap;
          letter-spacing: 0.3px;
        }
      </style>
      <div class="lower-third">
        <div class="accent-bar"></div>
        <div class="text-block">
          <div class="name-strip">
            <div class="name-text">${name}</div>
          </div>
          <div class="title-strip">
            <div class="title-text">${title}</div>
          </div>
        </div>
      </div>
    `;
  },
});
