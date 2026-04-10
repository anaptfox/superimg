// SVG Filter — Cinematic Filter Effects Demo
// Demonstrates: std.svg.filter() for blur, grain, color grading, glow

import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "CINEMATIC",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
    fonts: ["Space+Grotesk:wght@700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, sceneTimeSeconds: time, width, height } = ctx;

    // Three presets cycling through
    const presets = ["cinematic", "sepia", "noir"] as const;
    const labels = ["CINEMATIC", "SEPIA", "NOIR"];
    const bgColors = [
      ["#1a1a2e", "#16213e", "#0f3460"],
      ["#2d1b00", "#4a2c0a", "#6b3e1a"],
      ["#0a0a0a", "#1a1a1a", "#0a0a0a"],
    ];

    // Which preset is active
    const segIdx = Math.min(Math.floor(sceneProgress * 3), 2);
    const segProgress = (sceneProgress * 3) - segIdx;
    const preset = presets[segIdx];
    const label = labels[segIdx];
    const colors = bgColors[segIdx];

    // Text entrance/exit within each segment
    const textOpacity = std.interpolate(segProgress, [0, 0.15, 0.75, 1], [0, 1, 1, 0]);
    const textScale = std.tween(0.9, 1, Math.min(segProgress / 0.15, 1), "easeOutCubic");

    // Build filter
    const frame = Math.floor(time * 24);
    const f = std.svg.filter([
      { type: "grain", frequency: 0.65, octaves: 3, seed: frame, opacity: 0.25 },
      { type: "colorMatrix", preset },
      { type: "glow", radius: 15, color: colors[1], opacity: 0.3 },
    ]);

    // Background gradient
    const bg = `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`;

    // Overall fade
    const masterOpacity = std.interpolate(sceneProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

    return `
      <svg style="position:absolute;width:0;height:0">${f.svg}</svg>
      <div style="width:${width}px;height:${height}px;opacity:${masterOpacity}">
        <div style="position:absolute;inset:0;background:${bg};filter:${f.css}">
        </div>
        <div style="position:absolute;inset:0;${std.css.center()}">
          <div style="text-align:center;opacity:${textOpacity};transform:scale(${textScale})">
            <h1 style="font-family:'Space Grotesk',sans-serif;font-size:120px;color:white;
                        letter-spacing:16px;text-shadow:0 0 60px ${colors[1]}">
              ${label}
            </h1>
            <p style="font-family:monospace;font-size:18px;color:rgba(255,255,255,0.5);
                      margin-top:20px;letter-spacing:6px">
              SVG FILTER PRESET
            </p>
          </div>
        </div>
      </div>
    `;
  },
});
