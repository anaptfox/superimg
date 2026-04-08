// Spring & Stagger Demo — Showcases spring physics, staggered entrances, and multi-keyframe interpolation
// Demonstrates: std.stagger(), std.createSpring(), std.springTween(), std.interpolate(), std.interpolateColor(), std.phases()

import { defineScene } from "superimg";

export default defineScene({
  defaults: {
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

    // Phase splitting
    const { enter, exit } = std.phases(sceneProgress, { enter: 2, hold: 4, exit: 2 });

    // Background color interpolation through multiple stops
    const bgColor = std.interpolateColor(
      sceneProgress,
      [0, 0.3, 0.7, 1],
      ["#0f172a", "#1e1b4b", "#1e1b4b", "#0f172a"],
    );

    // Heading animation
    const headingOpacity = std.interpolate(sceneProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
    const headingY = std.springTween(30, 0, enter.progress, { stiffness: 80, damping: 14 });
    const headingExitY = std.tween(0, -30, exit.progress, "easeInCubic");

    // Stagger cards from center with spring physics
    const bounce = std.createSpring({ stiffness: 120, damping: 10 });
    const enterItems = std.stagger(items, enter.progress, {
      duration: 0.4,
      from: "center",
      easing: bounce,
    });

    // Exit stagger from edges
    const exitProgresses = std.stagger(items.length, exit.progress, {
      duration: 0.3,
      from: "edges",
      easing: "easeInCubic",
    });

    const cardHtml = enterItems
      .map(({ item, progress: enterP }, i) => {
        const exitP = exitProgresses[i];
        const y = std.tween(60, 0, enterP) + std.tween(0, -40, exitP);
        const opacity = std.interpolate(enterP, [0, 0.3, 1], [0, 1, 1])
                       * std.interpolate(exitP, [0, 0.7, 1], [1, 1, 0]);
        const scale = std.springTween(0.85, 1, enterP, { stiffness: 120, damping: 10 })
                     * std.tween(1, 0.9, exitP);

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
    }) + ";" + std.css.center();

    const headingStyle = std.css({
      opacity: headingOpacity,
      transform: `translateY(${headingY + headingExitY}px)`,
    });

    return `
      <div style="${bodyStyle}">
        <div style="${std.css.stack()}; align-items: center;">
          <div class="heading" style="${headingStyle}">The Process</div>
          <div class="grid">
            ${cardHtml}
          </div>
        </div>
      </div>
    `;
  },
});
