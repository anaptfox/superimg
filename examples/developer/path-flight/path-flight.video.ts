// Path Flight — Motion Path Demo
// Demonstrates: std.path() for animating elements along SVG curves

import { defineScene } from "superimg";

export default defineScene({
  data: {
    emoji: "🚀",
    trailCount: 8,
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0a0a1a; overflow: hidden; }
      .star {
        position: absolute; width: 3px; height: 3px;
        background: white; border-radius: 50%;
      }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { emoji, trailCount } = data;

    // Flight path — sweeping arc across the screen
    const flightPath = `M -80,${height * 0.8} C ${width * 0.3},${height * 0.1} ${width * 0.7},${height * 0.1} ${width + 80},${height * 0.8}`;
    const flight = std.path.parse(flightPath);

    // Fade in/out
    const opacity = std.interpolate(sceneProgress, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);

    // Main rocket position with easing
    const pt = flight.at(sceneProgress, { easing: "easeInOutCubic", rotateOffset: -90 });

    // Trail particles at earlier progress values
    const trail: string[] = [];
    for (let i = 1; i <= trailCount; i++) {
      const trailProgress = sceneProgress - i * 0.015;
      if (trailProgress < 0) continue;
      const tp = flight.at(trailProgress, { easing: "easeInOutCubic" });
      const trailOpacity = (1 - i / trailCount) * 0.6 * opacity;
      const trailSize = Math.max(4, 16 - i * 1.5);
      trail.push(
        `<div style="position:absolute;left:0;top:0;transform:translate(${tp.x}px,${tp.y}px);` +
        `width:${trailSize}px;height:${trailSize}px;border-radius:50%;` +
        `background:rgba(102,126,234,${trailOpacity})"></div>`
      );
    }

    // Starfield background
    const stars: string[] = [];
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.508) % width);
      const sy = ((i * 97.31 + 50) % height);
      const so = 0.3 + (i % 5) * 0.15;
      stars.push(`<div class="star" style="left:${sx}px;top:${sy}px;opacity:${so}"></div>`);
    }

    // Path visualization (subtle dotted line)
    const pathDots: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const dp = flight.at(i / 30);
      pathDots.push(
        `<div style="position:absolute;left:0;top:0;transform:translate(${dp.x}px,${dp.y}px);` +
        `width:4px;height:4px;border-radius:50%;background:rgba(102,126,234,0.15)"></div>`
      );
    }

    const rocketStyle = [
      `position:absolute;left:0;top:0`,
      `transform:${pt.transform}`,
      `font-size:48px`,
      `opacity:${opacity}`,
      `filter:drop-shadow(0 0 20px rgba(102,126,234,0.8))`,
    ].join(";");

    return `
      <div style="position:relative;width:${width}px;height:${height}px">
        ${stars.join("")}
        ${pathDots.join("")}
        ${trail.join("")}
        <div style="${rocketStyle}">${emoji}</div>
      </div>
    `;
  },
});
