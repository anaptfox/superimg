// SVG Morph — Shape Morphing Demo
// Demonstrates: std.svg.morph() + std.svg.shape for path interpolation

import { defineScene } from "superimg";

export default defineScene({
  data: {
    colorA: "#667eea",
    colorB: "#f093fb",
    colorC: "#4fd1c5",
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
    const { colorA, colorB, colorC } = data;

    // Shape center in local SVG coordinates
    const cx = 300;
    const cy = 300;
    const r = 180;

    // Generate shapes — both polygon(10) and star(5) produce 10 vertices
    const decagon = std.svg.shape.polygon(cx, cy, r, 10);
    const starShape = std.svg.shape.star(cx, cy, r * 1.2, r * 0.5, 5);

    // Two phases: morph in (50%), morph back (50%)
    const { enter: morphIn, hold: morphOut } = std.phases(sceneProgress, {
      enter: 5,
      hold: 5,
    });

    const morphInT = std.tween(0, 1, morphIn.progress, "easeInOutCubic");
    const morphOutT = std.tween(0, 1, morphOut.progress, "easeInOutCubic");

    let currentPath: string;
    let currentColor: string;
    let label: string;

    if (!morphIn.done) {
      currentPath = std.svg.morph(decagon, starShape, morphInT);
      currentColor = std.interpolateColor(morphInT, [0, 1], [colorA, colorB]);
      label = "POLYGON → STAR";
    } else {
      currentPath = std.svg.morph(starShape, decagon, morphOutT);
      currentColor = std.interpolateColor(morphOutT, [0, 1], [colorB, colorC]);
      label = "STAR → POLYGON";
    }

    // Gentle rotation (slow, not distracting)
    const rotation = sceneProgress * 45;

    // Overall fade
    const opacity = std.interpolate(sceneProgress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

    // Label
    const labelOpacity = std.interpolate(sceneProgress, [0.05, 0.15, 0.9, 1], [0, 0.7, 0.7, 0]);

    return `
      <div style="width:${width}px;height:${height}px;${std.css.center()};opacity:${opacity}">
        <div style="text-align:center">
          <svg width="600" height="600" viewBox="0 0 600 600">
            <path d="${currentPath}" fill="${currentColor}" opacity="0.9"
                  style="transform:rotate(${rotation}deg);transform-origin:${cx}px ${cy}px;
                         filter:drop-shadow(0 0 30px ${currentColor})" />
          </svg>
          <p style="color:rgba(255,255,255,${labelOpacity});font-family:'Space Grotesk',sans-serif;
                    font-size:20px;letter-spacing:6px;margin-top:-20px">
            ${label}
          </p>
        </div>
      </div>
    `;
  },
});
