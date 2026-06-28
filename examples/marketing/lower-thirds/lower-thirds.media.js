// Lower Thirds — broadcast-style speaker ID over transparent background
// Demonstrates: std.layers(), ctx.director(), std.stagger(), std.css.column()

import { define } from "superimg";

export default define({
  sample: {
    name: "Jane Doe",
    title: "Senior Engineer, Acme Corp",
    accentColor: "#3b82f6",
  },

  config: {
    fps: 30,
    duration: "4s",
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
      }
      .lower-third { display: flex; align-items: stretch; }
      .accent-bar { flex-shrink: 0; }
      .name-text { color: #ffffff; white-space: nowrap; letter-spacing: 0.5px; }
      .title-text { white-space: nowrap; letter-spacing: 0.3px; }
    `],
  },

  render(ctx) {
    const { std, width, height, isPortrait, data } = ctx;
    const { name, title, accentColor } = data;

    const nameSize = isPortrait ? 28 : 42;
    const titleSize = isPortrait ? 18 : 24;
    const barWidth = isPortrait ? 3 : 4;
    const namePadV = isPortrait ? 10 : 14;
    const namePadH = isPortrait ? 16 : 24;
    const titlePadV = isPortrait ? 8 : 10;
    const titlePadH = isPortrait ? 16 : 24;
    const bottomOffset = isPortrait ? 40 : 80;
    const offScreenX = -(width * 0.45);

    const t = ctx.director({ enter: "0.75s", hold: "2.5s", exit: "0.75s" });
    const enterP = std.stagger(3, t.in("enter"), { duration: "50%", easing: "easeOutCubic" });
    const exitP = std.stagger(3, t.in("exit"), { duration: "50%", from: "end", easing: "easeInCubic" });

    const slideX = (i) =>
      std.interpolate(enterP[i], [0, 1], [offScreenX, 0]) +
      std.interpolate(exitP[i], [0, 1], [0, offScreenX]);

    const nameBg = std.color.alpha("#000000", 0.85);
    const titleBg = std.color.alpha("#000000", 0.65);
    const barGlow = std.color.alpha(accentColor, 0.4);

    const lowerThirdHtml = `
      <div class="lower-third">
        <div class="accent-bar" style="${std.css({
          width: barWidth,
          background: accentColor,
          boxShadow: `0 0 12px ${barGlow}, 0 0 4px ${barGlow}`,
          transform: `translateX(${slideX(0)}px)`,
        })}"></div>
        <div style="${std.css.column()}">
          <div style="${std.css({
            background: nameBg,
            padding: `${namePadV}px ${namePadH}px`,
            transform: `translateX(${slideX(1)}px)`,
          })}">
            <div class="name-text" style="${std.css({ fontSize: nameSize, fontWeight: 700 })}">${name}</div>
          </div>
          <div style="${std.css({
            background: titleBg,
            padding: `${titlePadV}px ${titlePadH}px`,
            transform: `translateX(${slideX(2)}px)`,
            opacity: enterP[2] * (1 - exitP[2]),
          })}">
            <div class="title-text" style="${std.css({
              fontSize: titleSize,
              fontWeight: 400,
              color: std.color.alpha("#ffffff", 0.9),
            })}">${title}</div>
          </div>
        </div>
      </div>
    `;

    const L = std.layers({ width, height, mode: "transparent" });
    return L.render(
      L.overlay(lowerThirdHtml, {
        anchor: "bottom-left",
        offset: { x: 0, y: bottomOffset },
        safe: true,
      }),
    );
  },
});