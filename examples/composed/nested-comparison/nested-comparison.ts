import { define, Html, together } from "@foxworth/superimg";

const fps = 25;

function movingPanel(id: string, label: string, color: string, duration: `${number}f`) {
  return define({
    config: { width: 640, height: 720, fps, duration },
    render(ctx) {
      const x = Math.round(76 + ctx.timeline.progress * 430);
      return Html({
        id,
        width: "fill",
        height: "fill",
        html: `<div style="position:relative;width:100%;height:100%;background:${color};color:#fff;font:700 32px system-ui;overflow:hidden"><div style="position:absolute;left:36px;top:36px">${label}</div><div style="position:absolute;left:${x}px;top:330px;width:66px;height:66px;border-radius:50%;background:#fff"></div></div>`,
      });
    },
  });
}

const baseline = movingPanel("baseline", "BASELINE", "#173e4a", "100f");
const alternative = movingPanel("alternative", "ALTERNATIVE", "#39345f", "72f");

const detail = define({
  config: { width: 640, height: 360, fps, duration: "48f" },
  render(ctx) {
    const scale = (1 + ctx.timeline.progress * 0.4).toFixed(2);
    return Html({
      id: "detail",
      width: "fill",
      height: "fill",
      html: `<div style="position:relative;width:100%;height:100%;background:#f2c15f;color:#222338;font:700 30px system-ui;overflow:hidden"><div style="position:absolute;left:28px;top:24px">DETAIL</div><div style="position:absolute;left:50%;top:54%;width:95px;height:95px;border:12px solid #222338;border-radius:50%;transform:translate(-50%,-50%) scale(${scale})"></div></div>`,
    });
  },
});

// The nested Program uses its outer 960×540 placement as its canvas.
const split = together([
  { id: "baseline", content: baseline, rect: { x: 0, y: 0, width: 480, height: 540 }, fit: "contain" },
  { id: "alternative", content: alternative, rect: { x: 480, y: 0, width: 480, height: 540 }, fit: "contain" },
], { end: "hold" });

// The whole split becomes one placed child. Its children keep their own IDs,
// local clocks, and inner rectangles after this outer fit is applied.
export const nestedComparison = together([
  { id: "split", content: split, rect: { x: 64, y: 54, width: 960, height: 540 }, fit: "contain" },
  { id: "detail", content: detail, rect: { x: 920, y: 450, width: 300, height: 169 }, fit: "cover" },
], { end: "hold" });
