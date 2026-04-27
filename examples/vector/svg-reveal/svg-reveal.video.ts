// SVG Reveal — Clip-Path Reveal Transitions Demo
// Demonstrates: std.svg.reveal for circle, wipe, inset, and iris reveals

import { defineScene } from "superimg";

export default defineScene({
  data: {},

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    fonts: ["Space+Grotesk:wght@700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0a0a1a; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height } = ctx;

    const reveals = [
      { name: "CIRCLE", color: "#667eea", fn: (p: number) => std.svg.reveal.circle(p) },
      { name: "WIPE", color: "#f093fb", fn: (p: number) => std.svg.reveal.wipe(p, "right") },
      { name: "INSET", color: "#4fd1c5", fn: (p: number) => std.svg.reveal.inset(p) },
      { name: "IRIS", color: "#f6ad55", fn: (p: number) => std.svg.reveal.iris(p, 6) },
    ];

    const halfW = width / 2;
    const halfH = height / 2;
    const positions = [
      { x: 0, y: 0 },
      { x: halfW, y: 0 },
      { x: 0, y: halfH },
      { x: halfW, y: halfH },
    ];

    // Stagger the reveals
    const items = std.stagger(reveals, sceneProgress, {
      duration: 0.5,
      from: "start",
      easing: "easeOutCubic",
    });

    // Overall fade
    const masterOpacity = std.interpolate(sceneProgress, [0, 0.05, 0.9, 1], [0, 1, 1, 0]);

    const quadrants = items.map(({ item, progress: p }, i) => {
      const pos = positions[i];
      const clip = item.fn(p);

      return `
        <div style="position:absolute;left:${pos.x}px;top:${pos.y}px;width:${halfW}px;height:${halfH}px;
                    overflow:hidden">
          <div style="width:100%;height:100%;
                      background:linear-gradient(135deg, ${item.color}, ${std.color.darken(item.color, 0.3)});
                      clip-path:${clip};${std.css.center()}">
            <div style="text-align:center">
              <p style="color:white;font-family:'Space Grotesk',sans-serif;font-size:48px;
                        font-weight:700;letter-spacing:4px">
                ${item.name}
              </p>
              <p style="color:rgba(255,255,255,0.6);font-family:monospace;font-size:14px;
                        margin-top:8px;letter-spacing:2px">
                reveal.${item.name.toLowerCase()}()
              </p>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Grid lines
    const gridLines = `
      <div style="position:absolute;left:${halfW}px;top:0;width:2px;height:${height}px;background:rgba(255,255,255,0.1)"></div>
      <div style="position:absolute;left:0;top:${halfH}px;width:${width}px;height:2px;background:rgba(255,255,255,0.1)"></div>
    `;

    return `
      <div style="position:relative;width:${width}px;height:${height}px;opacity:${masterOpacity}">
        ${quadrants}
        ${gridLines}
      </div>
    `;
  },
});
