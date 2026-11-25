import { define, Html, time, together } from "@foxworth/superimg";

const fps = 10;
const size = { width: 320, height: 180 } as const;

function panel(id: string, color: string, label: string, duration: `${number}f`) {
  return define({
    config: { width: 160, height: 180, fps, duration },
    render(ctx) {
      return Html({
        id,
        width: "fill",
        height: "fill",
        html: `<div style="width:100%;height:100%;background:${color};color:#fff;font:700 20px system-ui;display:grid;place-items:center">${label}:${ctx.timeline.frame}</div>`,
      });
    },
  });
}

// A deliberately small retained fixture: the right leaf ends at frame 5 and
// holds while the left leaf continues through frame 10.
const scene = together([
  { id: "left", content: panel("left", "#d92828", "LEFT", "10f"), rect: { x: 0, y: 0, width: 160, height: 180 }, fit: "contain" },
  { id: "right", content: panel("right", "#204cce", "RIGHT", "5f"), rect: { x: 160, y: 0, width: 160, height: 180 }, fit: "contain" },
], { end: "hold" });

export default time(scene, { size, fps });
