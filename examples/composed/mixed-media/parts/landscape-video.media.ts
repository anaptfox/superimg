import { video, Frame, Fill, Stack, Text } from "@foxworth/superimg";

const INK = "#F2F5F7";
const FIELD = "#123D4A";
const MINT = "#7FE0C1";

export default video({
  size: { width: 1280, height: 720 },
  fps: 24,
  duration: "1s",
  render(ctx) {
    const { width, height } = ctx;
    const t = ctx.director({ enter: "18%", hold: "64%", exit: "18%" });
    const line = t.tween(0, width * 0.65, { id: "landscape-line", during: "enter", easing: "easeOutQuint" });
    const title = t.motion({ id: "landscape-title", x: 28 });
    return Frame(
      { id: "landscape-video", width, height },
      Fill({ color: FIELD }),
      Frame({ x: 120, y: Math.round(height * 0.59), width: Math.max(1, line), height: 10 }, Fill({ color: MINT })),
      Stack(
        { width: "fill", height: "fill", justify: "center", pad: { x: 120, y: 80 }, gap: 20 },
        Text({ id: "eyebrow", variant: "label", size: 24, weight: 700, letterSpacing: 4, color: MINT, motion: title }, "04 · LANDSCAPE VIDEO"),
        Text({ id: "title", variant: "display", size: 86, weight: 800, color: INK, motion: title }, "Keep the frame moving."),
        Text({ id: "note", variant: "body", size: 30, color: "#A9C0C6" }, "1280 × 720 · native fit"),
      ),
    );
  },
});
