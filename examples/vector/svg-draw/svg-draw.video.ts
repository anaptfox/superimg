// SVG Draw — Stroke Drawing Demo
// Demonstrates: std.svg.draw() for line-drawing reveal animations

import { defineScene } from "superimg";

export default defineScene({
  data: {
    strokeColor: "#667eea",
    fillColor: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { strokeColor, fillColor } = data;

    // Geometric logo: three interconnected diamonds
    const cx = width / 2;
    const cy = height / 2;
    const size = 120;
    const gap = 140;

    const diamond = (ox: number, oy: number) =>
      `M ${ox},${oy - size} L ${ox + size},${oy} L ${ox},${oy + size} L ${ox - size},${oy} Z`;

    const paths = [
      diamond(cx - gap, cy),
      diamond(cx, cy),
      diamond(cx + gap, cy),
      // Connecting lines
      `M ${cx - gap + size},${cy} L ${cx - size},${cy}`,
      `M ${cx + size},${cy} L ${cx + gap - size},${cy}`,
    ];

    const t = std.score({ enter: 0.6, hold: 0.2, exit: 0.2 });
    const enterP = t.within("enter");
    const holdP = t.within("hold");
    const exitP = t.within("exit");

    const items = std.stagger(paths, enterP, {
      duration: 0.5,
      from: "center",
      easing: "easeOutCubic",
    });

    const fillOpacity = t.motion([0, 0, 0.15, 0.15], "easeOutCubic");
    const exitOpacity = t.motion([1, 1, 1, 0], "easeInCubic");

    const svgPaths = items.map(({ item: d, progress: p }) => {
      const draw = std.svg.draw(d, p);
      return `<path d="${d}"
        fill="${fillColor}" fill-opacity="${fillOpacity}"
        stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        stroke-dasharray="${draw.strokeDasharray}"
        stroke-dashoffset="${draw.strokeDashoffset}" />`;
    }).join("\n");

    // Subtitle text
    const textOpacity = std.interpolate(sceneProgress, [0.3, 0.5, 0.85, 1], [0, 1, 1, 0]);
    const textY = std.interpolate(std.clamp01((sceneProgress - 0.3) / 0.2), [0, 1], [20, 0], "easeOutCubic");

    return `
      <div style="${std.css({ width, height, position: 'relative' })}; ${std.css.center()}">
        <div style="text-align:center">
          <svg width="${width}" height="${height * 0.6}" viewBox="${cx - 400} ${cy - 200} 800 400"
               style="opacity:${exitOpacity}">
            ${svgPaths}
          </svg>
          <p style="color:${strokeColor};font-size:24px;font-family:monospace;opacity:${textOpacity};
                    transform:translateY(${textY}px);letter-spacing:8px">
            STROKE DRAWING
          </p>
        </div>
      </div>
    `;
  },
});
