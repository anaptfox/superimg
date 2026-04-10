// SVG Shapes — Geometric Shape Generators Demo
// Demonstrates: std.svg.shape for circle, star, polygon, wave, arc, roundedRect

import { defineScene } from "superimg";

export default defineScene({
  data: {
    accentColor: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    fonts: ["Space+Grotesk:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { accentColor } = data;

    const cx = 960;
    const cy = 440;

    // Phase timing
    const { enter, hold, exit } = std.phases(sceneProgress, { enter: 3, hold: 4, exit: 3 });
    const fadeIn = std.tween(0, 1, enter.progress, "easeOutCubic");
    const fadeOut = 1 - std.tween(0, 1, exit.progress, "easeInCubic");
    const opacity = fadeIn * fadeOut;

    // Center polygon — slowly rotates, sides animate
    const centerR = std.springTween(0, 120, enter.progress, { stiffness: 80, damping: 14 });
    const rotation = sceneProgress * 120;
    const centerPoly = std.svg.shape.polygon(cx, cy, centerR, 6);

    // Ring of shapes around center
    const ringShapes = [
      { gen: () => std.svg.shape.star(0, 0, 35, 15, 5), color: "#f093fb" },
      { gen: () => std.svg.shape.polygon(0, 0, 30, 3), color: "#4fd1c5" },
      { gen: () => std.svg.shape.circle(0, 0, 25), color: "#f6ad55" },
      { gen: () => std.svg.shape.star(0, 0, 30, 12, 4), color: "#fc8181" },
      { gen: () => std.svg.shape.polygon(0, 0, 28, 5), color: "#90cdf4" },
      { gen: () => std.svg.shape.star(0, 0, 32, 14, 6), color: "#c084fc" },
    ];

    const ringR = 280;
    const items = std.stagger(ringShapes, enter.progress, {
      duration: 0.4,
      from: "center",
    });

    const ringElements = items.map(({ item, progress: p }, i) => {
      const angle = (i / ringShapes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle + sceneProgress * 0.5) * ringR;
      const y = cy + Math.sin(angle + sceneProgress * 0.5) * ringR;
      const scale = std.springTween(0, 1, p, { stiffness: 120, damping: 10 });
      const itemRotation = sceneProgress * 180 * (i % 2 === 0 ? 1 : -1);

      return `<g transform="translate(${x}, ${y}) scale(${scale}) rotate(${itemRotation})">
        <path d="${item.gen()}" fill="${item.color}" opacity="0.85" />
      </g>`;
    }).join("\n");

    // Wave decoration at bottom
    const waveAmp = std.tween(0, 50, enter.progress, "easeOutCubic");
    const wavePhase = sceneProgress * Math.PI * 4;
    const wave = std.svg.shape.wave(width, 200, waveAmp, 3, wavePhase);
    const waveColor = std.color.alpha(accentColor, 0.3);

    // Arc decorations
    const arcProgress = sceneProgress * 360;
    const arcPath = std.svg.shape.arc(cx, cy, 200, arcProgress, arcProgress + 120);

    return `
      <div style="position:relative;width:${width}px;height:${height}px;opacity:${opacity}">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- Center hexagon -->
          <g transform="rotate(${rotation}, ${cx}, ${cy})">
            <path d="${centerPoly}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.6" />
          </g>

          <!-- Orbital arc -->
          <path d="${arcPath}" fill="none" stroke="${accentColor}" stroke-width="1.5"
                opacity="0.3" stroke-linecap="round" />

          <!-- Ring shapes -->
          ${ringElements}

          <!-- Wave -->
          <path d="${wave}" fill="none" stroke="${waveColor}" stroke-width="2"
                transform="translate(0, ${height - 180})" />
        </svg>

        <p style="position:absolute;bottom:40px;width:100%;text-align:center;
                  color:rgba(255,255,255,0.5);font-family:'Space Grotesk',sans-serif;
                  font-size:18px;letter-spacing:6px;opacity:${opacity}">
          SVG SHAPE GENERATORS
        </p>
      </div>
    `;
  },
});
