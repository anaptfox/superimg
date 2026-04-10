// Lower Thirds Example — Broadcast-style speaker identification
// Demonstrates: std.css(), std.css.stack(), std.stagger(), std.phases(), color.alpha()
// Customize by passing data or editing the defaults!

import { defineScene } from "superimg";

export default defineScene({
  data: {
    name: "Jane Doe",
    title: "Senior Engineer, Acme Corp",
    accentColor: "#3b82f6",
  },

  config: {
    fps: 30,
    duration: 4,
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
    const { std, sceneProgress, width, height, isPortrait, data } = ctx;
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

    // Split into enter / hold / exit phases
    const { enter, exit } = std.phases(sceneProgress, { enter: 1.5, hold: 5, exit: 1.5 });

    // Staggered slide-in (bar → name → title)
    const enterP = std.stagger(3, enter.progress, { duration: 0.5, easing: "easeOutCubic" });
    // Staggered slide-out (reverse: title → name → bar)
    const exitP = std.stagger(3, exit.progress, { duration: 0.5, from: "end", easing: "easeInCubic" });

    const barX = std.tween(offScreenX, 0, enterP[0]) + std.tween(0, offScreenX, exitP[0]);
    const nameX = std.tween(offScreenX, 0, enterP[1]) + std.tween(0, offScreenX, exitP[1]);
    const titleX = std.tween(offScreenX, 0, enterP[2]) + std.tween(0, offScreenX, exitP[2]);
    const titleOpacity = enterP[2] * (1 - exitP[2]);

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
