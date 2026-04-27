// Spring & Stagger Demo — showcases score(), spring physics, stagger, and multi-keyframe interpolation.

import { defineScene } from "superimg";

export default defineScene({
  data: {
    items: ["Design", "Build", "Test", "Ship", "Scale", "Iterate"],
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    fonts: ["Inter:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 32px;
        max-width: 1200px;
        width: 100%;
      }
      .card {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 48px 32px;
        text-align: center;
        backdrop-filter: blur(8px);
      }
      .card-label {
        font-size: 28px;
        font-weight: 700;
        color: white;
        letter-spacing: 0.5px;
      }
      .card-number {
        font-size: 18px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 16px;
      }
      .heading {
        font-size: 56px;
        font-weight: 700;
        color: white;
        margin-bottom: 48px;
        letter-spacing: -1px;
      }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const items = data.items as string[];

    const t = std.score({ enter: 0.25, hold: 0.5, exit: 0.25 });
    const enterP = t.within("enter");
    const exitP = t.within("exit");

    const bgColor = std.interpolateColor(
      sceneProgress,
      [0, 0.3, 0.7, 1],
      ["#0f172a", "#1e1b4b", "#1e1b4b", "#0f172a"],
    );

    const headingOpacity = std.interpolate(sceneProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
    const headingY = std.spring(30, 0, enterP, { stiffness: 80, damping: 14 });
    const headingExitY = std.interpolate(exitP, [0, 1], [0, -30], "easeInCubic");

    const bounce = (p: number) => std.spring(0, 1, p, { stiffness: 120, damping: 10 });
    const enterItems = std.stagger(items, enterP, {
      duration: 0.4,
      from: "center",
      easing: bounce,
    });

    const exitProgresses = std.stagger(items.length, exitP, {
      duration: 0.3,
      from: "edges",
      easing: "easeInCubic",
    });

    const cardHtml = enterItems
      .map(({ item, progress: ep }, i) => {
        const xp = exitProgresses[i]!;
        const y = std.interpolate(ep, [0, 1], [60, 0]) + std.interpolate(xp, [0, 1], [0, -40]);
        const opacity = std.interpolate(ep, [0, 0.3, 1], [0, 1, 1])
                       * std.interpolate(xp, [0, 0.7, 1], [1, 1, 0]);
        const scale = std.spring(0.85, 1, ep, { stiffness: 120, damping: 10 })
                     * std.interpolate(xp, [0, 1], [1, 0.9]);

        const cardStyle = std.css({
          transform: `translateY(${y}px) scale(${scale})`,
          opacity,
        });

        return `
          <div class="card" style="${cardStyle}">
            <div class="card-number">0${i + 1}</div>
            <div class="card-label">${item}</div>
          </div>
        `;
      })
      .join("");

    const bodyStyle = std.css({
      width,
      height,
      background: bgColor,
    }, std.css.center());

    const headingStyle = std.css({
      opacity: headingOpacity,
      transform: `translateY(${headingY + headingExitY}px)`,
    });

    return `
      <div style="${bodyStyle}">
        <div style="${std.css(std.css.stack())}; align-items: center;">
          <div class="heading" style="${headingStyle}">The Process</div>
          <div class="grid">
            ${cardHtml}
          </div>
        </div>
      </div>
    `;
  },
});
