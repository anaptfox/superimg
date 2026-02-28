// Lower Thirds Example — Broadcast-style speaker identification
// Demonstrates: std.css(), std.css.stack(), inlineCss, staggered tweens, color.alpha()
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
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: transparent;
        font-family: 'Inter', sans-serif;
        overflow: hidden;
        position: relative;
      }
      .lower-third { position: absolute; left: 0; display: flex; align-items: stretch; }
      .accent-bar { flex-shrink: 0; }
      .name-text { color: #ffffff; white-space: nowrap; letter-spacing: 0.5px; }
      .title-text { white-space: nowrap; letter-spacing: 0.3px; }
    `],
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
    const barEnter = std.math.clamp(time / 0.6, 0, 1);
    const nameEnter = std.math.clamp((time - 0.15) / 0.7, 0, 1);
    const titleEnter = std.math.clamp((time - 0.35) / 0.7, 0, 1);

    // Exit phase (staggered slide-out, reverse order)
    const titleExit = std.math.clamp((time - 2.8) / 0.5, 0, 1);
    const nameExit = std.math.clamp((time - 2.95) / 0.5, 0, 1);
    const barExit = std.math.clamp((time - 3.15) / 0.5, 0, 1);

    const barX = std.tween(offScreenX, 0, barEnter, "easeOutCubic") + std.tween(0, offScreenX, barExit, "easeInCubic");
    const nameX = std.tween(offScreenX, 0, nameEnter, "easeOutCubic") + std.tween(0, offScreenX, nameExit, "easeInCubic");
    const titleX = std.tween(offScreenX, 0, titleEnter, "easeOutCubic") + std.tween(0, offScreenX, titleExit, "easeInCubic");
    const titleOpacity = titleEnter * (1 - titleExit);

    const nameBg  = std.color.alpha("#000000", 0.85);
    const titleBg = std.color.alpha("#000000", 0.65);
    const barGlow = std.color.alpha(accentColor, 0.4);

    const bodyStyle = std.css({ width, height });
    const lowerThirdStyle = std.css({ bottom: bottomOffset });
    const barStyle = std.css({
      width: barWidth, background: accentColor,
      boxShadow: "0 0 12px " + barGlow + ", 0 0 4px " + barGlow,
      transform: "translateX(" + barX + "px)",
    });
    const nameStripStyle = std.css({
      background: nameBg,
      padding: namePadV + "px " + namePadH + "px",
      transform: "translateX(" + nameX + "px)",
    });
    const titleStripStyle = std.css({
      background: titleBg,
      padding: titlePadV + "px " + titlePadH + "px",
      transform: "translateX(" + titleX + "px)",
      opacity: titleOpacity,
    });
    const nameTextStyle = std.css({ fontSize: nameSize, fontWeight: 700 });
    const titleTextStyle = std.css({
      fontSize: titleSize, fontWeight: 400,
      color: std.color.alpha("#ffffff", 0.9),
    });

    return `
      <div style="${bodyStyle}">
        <div class="lower-third" style="${lowerThirdStyle}">
          <div class="accent-bar" style="${barStyle}"></div>
          <div style="${std.css.stack()}">
            <div style="${nameStripStyle}">
              <div class="name-text" style="${nameTextStyle}">${name}</div>
            </div>
            <div style="${titleStripStyle}">
              <div class="title-text" style="${titleTextStyle}">${title}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
});
